import { jest } from '@jest/globals';

const approvedValues = await import('../../approved-values.js');
const { default: EventBus } = await import('../../event-bus.js');
const { InstrumentChartBuilder } = await import('../../templates/InstrumentChart/instrument-chart.builder.js');

function makeSection(caption, chartChord, key) {
  return { beats: 4, caption, chartChord, chartMode: 'Ionian', getRootKey: () => key, getRootKeyLead: () => key };
}

const sections = [makeSection('One', 'C', 'C'), makeSection('Two', 'G', 'G')];
const EVENT = 'Widget:SectionStatus:statusChanged';

function emit(ownerID, sectionNumber) {
  EventBus.trigger(EVENT, { ownerID, sectionNumber });
}

beforeEach(() => {
  approvedValues.setApprovedValueProviders({
    getBPM: () => 100,
    getCurrentSection: () => sections[0],
    getSectionsCurrentIndex: () => 0,
    getSong: () => ({ sections }),
    getRootKey: () => 'C',
    getRootKeyLead: () => 'C',
    getChartDisplayForSection: (kind, section) => (kind === 'chord' ? section.chartChord : section.chartMode)
  });
  InstrumentChartBuilder.setProviders({ getSection: (idx) => sections[idx] });
  InstrumentChartBuilder.removeAll();
  InstrumentChartBuilder.setMode({ top: false, left: false });
});

afterAll(() => {
  InstrumentChartBuilder.removeAll();
});

describe('InstrumentChartBuilder', () => {
  test('a widget stays empty while its placement is off, then fills when turned on', () => {
    const host = { innerHTML: '' };
    InstrumentChartBuilder.createWidget(host, 'tblA', 'left', { instrumentCaption: 'A' });
    emit('tblA', 2);
    expect(host.innerHTML).toBe('');
    InstrumentChartBuilder.setMode({ left: true });
    expect(host.innerHTML).toBe('<small>&sect;2</small><br><b>G</b><br>G');
  });

  test('statusChanged updates the widget with that table\'s Section only', () => {
    const hostA = { innerHTML: '' };
    const hostB = { innerHTML: '' };
    InstrumentChartBuilder.createWidget(hostA, 'tblA', 'left');
    InstrumentChartBuilder.createWidget(hostB, 'tblB', 'left');
    InstrumentChartBuilder.setMode({ left: true });
    emit('tblA', 1);
    emit('tblB', 2);
    expect(hostA.innerHTML).toContain('&sect;1');
    expect(hostB.innerHTML).toContain('&sect;2');
    emit('tblA', 2);
    expect(hostA.innerHTML).toContain('&sect;2');
    expect(hostB.innerHTML).toContain('&sect;2');
  });

  test('events without a sectionNumber are ignored', () => {
    const host = { innerHTML: '' };
    InstrumentChartBuilder.createWidget(host, 'tblA', 'left');
    InstrumentChartBuilder.setMode({ left: true });
    emit('tblA', '');
    emit('tblA', undefined);
    expect(host.innerHTML).toBe('');
  });

  test('writes the host only when the HTML changed', () => {
    let writes = 0;
    let html = '';
    const host = { get innerHTML() { return html; }, set innerHTML(v) { writes++; html = v; } };
    InstrumentChartBuilder.createWidget(host, 'tblA', 'left');
    InstrumentChartBuilder.setMode({ left: true });
    emit('tblA', 1);
    emit('tblA', 1);
    InstrumentChartBuilder.refreshAll();
    expect(writes).toBe(1);
    sections[0].chartChord = 'D';
    InstrumentChartBuilder.refreshAll();
    expect(writes).toBe(2);
    sections[0].chartChord = 'C';
  });

  test('top and left widgets of one Instrument are independent', () => {
    const top = { innerHTML: '' };
    const left = { innerHTML: '' };
    InstrumentChartBuilder.createWidget(top, 'tblA', 'top', { instrumentCaption: 'A' });
    InstrumentChartBuilder.createWidget(left, 'tblA', 'left');
    emit('tblA', 1);
    InstrumentChartBuilder.setMode({ top: true });
    expect(top.innerHTML).toContain('One');
    expect(left.innerHTML).toBe('');
  });

  test('setMode merges and getMode returns a copy', () => {
    InstrumentChartBuilder.setMode({ top: true });
    InstrumentChartBuilder.setMode({ left: true });
    expect(InstrumentChartBuilder.getMode()).toEqual({ top: true, left: true });
    InstrumentChartBuilder.setMode({ top: false });
    expect(InstrumentChartBuilder.getMode()).toEqual({ top: false, left: true });
    InstrumentChartBuilder.getMode().top = true;
    expect(InstrumentChartBuilder.getMode().top).toBe(false);
  });

  test('removeByOwnerID and removeAll unsubscribe from the EventBus', () => {
    const hostA = { innerHTML: '' };
    const hostB = { innerHTML: '' };
    InstrumentChartBuilder.createWidget(hostA, 'tblA', 'left');
    InstrumentChartBuilder.createWidget(hostB, 'tblB', 'left');
    InstrumentChartBuilder.setMode({ left: true });
    InstrumentChartBuilder.removeByOwnerID('tblA');
    emit('tblA', 1);
    emit('tblB', 1);
    expect(hostA.innerHTML).toBe('');
    expect(hostB.innerHTML).toContain('&sect;1');
    InstrumentChartBuilder.removeAll();
    expect(InstrumentChartBuilder.registry.size).toBe(0);
    hostB.innerHTML = '';
    emit('tblB', 2);
    expect(hostB.innerHTML).toBe('');
  });
});
