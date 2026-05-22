export class MenuItemProxy {
  constructor(owner, spec = {}) {
    this.owner = owner;
    this.name = spec.name || '';
    this.caption = spec.caption || '';
    this.trigger = spec.trigger || '';
    this.action = spec.action || '';
    this.children = Array.isArray(spec.children) ? spec.children : [];
    this.input = spec.input || null;
    this.vars = Array.isArray(spec.vars) ? spec.vars : [];
    this.popOnBang = !!spec.popOnBang;

    this.pluginId = spec.pluginId;
    this.propertyName = spec.propertyName;
    this.actionName = spec.actionName;
    this.value = spec.value;
    this.runtimeChildren = spec.runtimeChildren;
  }
}

export default MenuItemProxy;
