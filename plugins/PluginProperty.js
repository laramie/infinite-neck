import { MenuItemProxy } from './MenuItemProxy.js';

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (value && typeof value === 'object') {
    return { ...value };
  }
  return value;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildCaption(caption, trigger) {
  const text = `${caption || ''}`;
  const key = `${trigger || ''}`;
  if (key.length === 0) {
    return text;
  }

  const match = new RegExp(escapeRegex(key), 'i').exec(text);
  if (!match) {
    return `<b>${key}</b> ${text}`.trim();
  }

  const idx = match.index;
  return `${text.slice(0, idx)}<b>${text.slice(idx, idx + key.length)}</b>${text.slice(idx + key.length)}`;
}

export function buildValueReference(token) {
  return '${' + token + '}';
}

function normalizeIntegerString(rawValue) {
  const text = `${rawValue}`.trim();
  if (!/^-?\d+$/.test(text)) {
    throw new Error(`Expected integer, received: ${rawValue}`);
  }
  return Number.parseInt(text, 10);
}

function normalizeBoolean(rawValue) {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }
  const text = `${rawValue}`.trim();
  if (text === 'true') {
    return true;
  }
  if (text === 'false') {
    return false;
  }
  throw new Error(`Expected true or false, received: ${rawValue}`);
}

function normalizeIntegerArray(rawValue) {
  const parsed = Array.isArray(rawValue) ? rawValue : JSON.parse(`${rawValue}`);
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of integers');
  }
  return parsed.map((value) => {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    return normalizeIntegerString(value);
  });
}

export class PluginProperty {
  constructor(spec = {}) {
    this.name = spec.name || '';
    this.caption = spec.caption || this.name;
    this.trigger = spec.trigger || '';
    this.datatype = spec.datatype || 'String';
    this.value = cloneValue(spec.value);
    this.defaultValue = cloneValue(spec.defaultValue ?? spec.value);
    this.visibleInMenu = spec.visibleInMenu !== false;
    this.inputCaption = spec.inputCaption || '';
    this.options = Array.isArray(spec.options) ? spec.options.map((option) => ({ ...option })) : [];
    this.actionName = spec.actionName || '';
    this.help = spec.help || '';
  }

  getValue() {
    return cloneValue(this.value);
  }

  getDefaultValue() {
    return cloneValue(this.defaultValue);
  }

  reset() {
    this.value = cloneValue(this.defaultValue);
  }

  normalize(rawValue) {
    switch (this.datatype) {
      case 'Number':
        return normalizeIntegerString(rawValue);
      case 'boolean':
      case 'org.dynamide.toggle':
        return normalizeBoolean(rawValue);
      case 'org.dynamide.IntegerArray':
        return normalizeIntegerArray(rawValue);
      case 'org.dynamide.Select':
        return `${rawValue}`;
      case 'org.dynamide.Action':
        return `${rawValue}`;
      case 'String':
      default:
        return `${rawValue}`;
    }
  }

  setValue(rawValue) {
    const normalized = this.normalize(rawValue);
    if (this.datatype === 'org.dynamide.Select' && this.options.length > 0) {
      const allowed = this.options.map((option) => `${option.value}`);
      if (!allowed.includes(`${normalized}`)) {
        throw new Error(`Expected one of ${allowed.join(', ')}, received: ${rawValue}`);
      }
    }
    this.value = normalized;
    return this.getValue();
  }

  toPersistedValue() {
    return cloneValue(this.value);
  }

  getResolverToken(pluginId) {
    return `plugin:${pluginId}:${this.name}`;
  }

  getMenuNodeSpec(plugin) {
    const pluginId = plugin.getId();
    const token = this.getResolverToken(pluginId);
    const captionWithValue = `${buildCaption(this.caption, this.trigger)} [${buildValueReference(token)}]`;
    const vars = [token];

    if (this.datatype === 'org.dynamide.Action') {
      return new MenuItemProxy(plugin, {
        name: this.name,
        caption: buildCaption(this.caption, this.trigger),
        trigger: this.trigger,
        action: 'pluginAction:invoke',
        pluginId,
        actionName: this.actionName
      });
    }

    if (this.datatype === 'org.dynamide.toggle') {
      return new MenuItemProxy(plugin, {
        name: this.name,
        caption: captionWithValue,
        trigger: this.trigger,
        action: 'pluginProperty:toggle',
        pluginId,
        propertyName: this.name,
        vars
      });
    }

    if (this.datatype === 'org.dynamide.Select') {
      const children = this.options.map((option) => new MenuItemProxy(plugin, {
        name: `${this.name}:${option.value}`,
        caption: buildCaption(option.caption, option.trigger),
        trigger: option.trigger,
        action: 'pluginProperty:select',
        pluginId,
        propertyName: this.name,
        value: option.value,
        popOnBang: true
      }));
      return new MenuItemProxy(plugin, {
        name: this.name,
        caption: captionWithValue,
        trigger: this.trigger,
        vars,
        children
      });
    }

    return new MenuItemProxy(plugin, {
      name: this.name,
      caption: captionWithValue,
      trigger: this.trigger,
      action: 'pluginProperty:set',
      pluginId,
      propertyName: this.name,
      vars,
      popOnBang: true,
      input: {
        type: 'input',
        caption: this.inputCaption || this.datatype,
        default: token,
        datatype: this.datatype,
        id: 'value'
      }
    });
  }
}

export default PluginProperty;
