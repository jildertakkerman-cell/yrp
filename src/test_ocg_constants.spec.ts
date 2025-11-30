import { ReplayDecoder } from './replay_decoder';

describe('ReplayDecoder OCG Constants', () => {
    it('should correctly identify new message IDs', () => {
        // Test a sample of new message IDs
        expect(ReplayDecoder['getMsgName'](24)).toBe('MSG_SELECT_DISFIELD');
        expect(ReplayDecoder['getMsgName'](25)).toBe('MSG_SORT_CARD');
        expect(ReplayDecoder['getMsgName'](26)).toBe('MSG_SELECT_UNSELECT_CARD');
        expect(ReplayDecoder['getMsgName'](190)).toBe('MSG_REMOVE_CARDS');

        // Test some existing ones to ensure no regression
        expect(ReplayDecoder['getMsgName'](1)).toBe('MSG_RETRY');
        expect(ReplayDecoder['getMsgName'](40)).toBe('MSG_NEW_TURN');
    });

    it('should handle unknown message IDs gracefully', () => {
        expect(ReplayDecoder['getMsgName'](999)).toBe('UNKNOWN_MSG_999');
    });
});
