import { PluginProperty } from '../../plugins/PluginProperty.js';

describe('PluginProperty', () => {
    test('Instrument select menu includes id input child after numeric options', () => {
        const property = new PluginProperty({
            name: 'targetTable',
            caption: 'Instrument',
            trigger: 'I',
            datatype: 'org.dynamide.Select',
            value: 'tblBass4_1',
            options: [
                { value: 'tblBass4_1', caption: '1) Bass4_1', trigger: '1' },
                { value: 'tblBass5_1', caption: '2) Bass5_1', trigger: '2' }
            ]
        });
        const plugin = { getId: () => 'arpeggio' };

        const menuNode = property.getMenuNodeSpec(plugin);

        expect(menuNode.children.map((child) => child.trigger)).toEqual(['1', '2', 'i']);
        expect(menuNode.children[2]).toEqual(expect.objectContaining({
            name: 'targetTable:id',
            action: 'pluginProperty:selectByBaseID',
            pluginId: 'arpeggio',
            propertyName: 'targetTable',
            popOnBang: true,
            input: expect.objectContaining({ id: 'value', caption: 'baseID' })
        }));
    });

    test('other select properties do not include id input child', () => {
        const property = new PluginProperty({
            name: 'style',
            caption: 'style',
            trigger: 'y',
            datatype: 'org.dynamide.Select',
            value: 'every',
            options: [
                { value: 'every', caption: 'every', trigger: 'e' }
            ]
        });
        const plugin = { getId: () => 'arpeggio' };

        const menuNode = property.getMenuNodeSpec(plugin);

        expect(menuNode.children.map((child) => child.trigger)).toEqual(['e']);
    });
});
