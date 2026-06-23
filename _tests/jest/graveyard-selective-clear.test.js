import { Graveyard, GraveType } from '../../graveyard.js';

describe('Graveyard selective cleanup and delete links', () => {
  test('clearByTypes removes only selected GraveType records', () => {
    const graveyard = new Graveyard({
      records: [
        { type: GraveType.SECTION, json: '{}', context: {}, timestamp: 1, date: 'd', time: 't' },
        { type: GraveType.PLUGIN, json: '{}', context: {}, timestamp: 2, date: 'd', time: 't' },
        { type: GraveType.STYLESHEET, json: '{}', context: {}, timestamp: 3, date: 'd', time: 't' }
      ]
    });

    const removed = graveyard.clearByTypes([GraveType.SECTION, GraveType.PLUGIN]);

    expect(removed).toBe(2);
    expect(graveyard.records).toHaveLength(1);
    expect(graveyard.records[0].type).toBe(GraveType.STYLESHEET);
  });

  test('deleteRecordByIndex removes one record and returns removed payload', () => {
    const graveyard = new Graveyard({
      records: [
        { type: GraveType.SECTION, json: '{}', context: {}, timestamp: 1, date: 'd', time: 't' },
        { type: GraveType.PLUGIN, json: '{}', context: {}, timestamp: 2, date: 'd', time: 't' }
      ]
    });

    const removed = graveyard.deleteRecordByIndex(0);

    expect(removed?.type).toBe(GraveType.SECTION);
    expect(graveyard.records).toHaveLength(1);
    expect(graveyard.records[0].type).toBe(GraveType.PLUGIN);
  });

  test('buildGraveyardTable renders delete link in ACTION column for expanded row and underscore labels', () => {
    const graveyard = new Graveyard({
      records: [
        { type: GraveType.SECTION, json: '{"x":1}', context: { hello: 'world' }, timestamp: 111, date: 'd', time: 't' },
        { type: GraveType.CLIP, json: '{"y":2}', context: { hello: 'clip' }, timestamp: 222, date: 'd', time: 't' }
      ]
    });

    const html = graveyard.buildGraveyardTable();

    expect(html).toContain('raise_0');
    expect(html).toContain('delete_0');
    expect(html).toContain('delete_1');
    expect(html).toContain("class='graveyard-delete-link'");
    expect(html).toContain("data-delete-target='#graveDelete111_0'");
    expect(html).toContain('<td colspan=\'6\'>');
  });
});
