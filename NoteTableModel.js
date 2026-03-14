export class NoteTableModel {
    constructor({ tableId, relativeSection = '', caption = '', enabled = true } = {}) {
        this.tableId = tableId;
        this.relativeSection = relativeSection ?? '';
        this.caption = caption ?? '';
        this.enabled = enabled !== false;
    }

    getTableId() {
        return this.tableId;
    }

    getRelativeSection() {
        return this.relativeSection ?? '';
    }

    setRelativeSection(spec = '') {
        this.relativeSection = spec ?? '';
    }

    resolveSectionIndex(song) {
        const relative = this.getRelativeSection();
        if (!song) {
            return -1;
        }
        if (!relative) {
            return song.getSectionsCurrentIndex();
        }
        return song.getRelativeSectionIndexWithWrap(relative);
    }

    resolveSection(song) {
        const relative = this.getRelativeSection();
        if (!song) {
            return null;
        }
        if (!relative) {
            return song.getCurrentSection();
        }
        return song.getRelativeSectionWithWrap(relative);
    }

    isObserver() {
        return this.getRelativeSection() !== '';
    }

    allowsCellEditing() {
        return !this.isObserver();
    }

    allowsBeatPlayback() {
        return !this.isObserver();
    }

    allowsBeatRecording() {
        return !this.isObserver();
    }

    toJSON() {
        return {
            relativeSection: this.getRelativeSection(),
            caption: this.caption ?? '',
            enabled: this.enabled !== false
        };
    }

    static fromJSON(tableId, payload = {}) {
        return new NoteTableModel({
            tableId,
            relativeSection: payload.relativeSection ?? '',
            caption: payload.caption ?? '',
            enabled: payload.enabled !== false
        });
    }
}

export class NoteTableRegistry {
    constructor() {
        this.models = new Map();
    }

    register(model) {
        if (!model || !model.getTableId || !model.getTableId()) {
            return null;
        }
        this.models.set(model.getTableId(), model);
        return model;
    }

    get(tableId) {
        return this.models.get(tableId) ?? null;
    }

    getAll() {
        return Array.from(this.models.values());
    }

    clear() {
        this.models.clear();
    }

    ensure(tableId, defaults = {}) {
        const existing = this.get(tableId);
        if (existing) {
            return existing;
        }
        const created = new NoteTableModel({ tableId, ...defaults });
        this.register(created);
        return created;
    }

    hydrateFromFile(fileObj = {}) {
        this.clear();

        const explicit = fileObj.noteTableModels;
        if (explicit && typeof explicit === 'object') {
            Object.entries(explicit).forEach(([tableId, payload]) => {
                this.register(NoteTableModel.fromJSON(tableId, payload));
            });
            return this;
        }

        const visible = Array.isArray(fileObj.visibleNoteTables)
            ? fileObj.visibleNoteTables
            : [];

        visible.forEach((tableId) => {
            this.ensure(tableId, {
                relativeSection: '',
                caption: '',
                enabled: true
            });
        });

        return this;
    }

    getSectionForTable(tableId, song) {
        const model = this.get(tableId);
        if (model) {
            return model.resolveSection(song);
        }
        if (!song) {
            return null;
        }
        return song.getCurrentSection();
    }

    isObserverTable(tableId) {
        const model = this.get(tableId);
        return model ? model.isObserver() : false;
    }

    toSnapshot() {
        const out = {};
        this.getAll().forEach((model) => {
            out[model.getTableId()] = model.toJSON();
        });
        return out;
    }
}
