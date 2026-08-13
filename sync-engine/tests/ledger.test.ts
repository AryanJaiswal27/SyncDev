import { LedgerManager } from '../ledger';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

describe('LedgerManager', () => {
    const mockRoot = '/mock/root';
    const mockLedgerPath = path.join(mockRoot, '.prompt', 'ledger.json');
    let manager: LedgerManager;

    beforeEach(() => {
        manager = new LedgerManager(mockRoot);
        jest.clearAllMocks();
    });

    it('should create a new ledger file if none exists', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        const writeSpy = (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
        const mkdirSpy = (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);

        await manager.appendInteraction({
            timestamp: '2026-08-11T12:00:00Z',
            userPrompt: 'Test prompt',
            agentAction: 'Test action',
            agentPayload: 'Test payload'
        });

        expect(mkdirSpy).toHaveBeenCalledWith(path.dirname(mockLedgerPath), { recursive: true });
        expect(writeSpy).toHaveBeenCalled();
        const callArgs = writeSpy.mock.calls[0];
        expect(callArgs[0]).toBe(mockLedgerPath);
        
        const writtenData = JSON.parse(callArgs[1]);
        expect(writtenData.interactions).toHaveLength(1);
        expect(writtenData.interactions[0].userPrompt).toBe('Test prompt');
    });

    it('should gracefully handle corrupt JSON', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.promises.readFile as jest.Mock).mockResolvedValue('invalid{json');
        const writeSpy = (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

        await manager.appendInteraction({
            timestamp: '2026-08-11T12:00:00Z',
            userPrompt: 'Test prompt',
            agentAction: 'Test action',
            agentPayload: 'Test payload'
        });

        // Should recover and create a fresh array with the new item
        expect(writeSpy).toHaveBeenCalled();
        const callArgs = writeSpy.mock.calls[0];
        const writtenData = JSON.parse(callArgs[1]);
        expect(writtenData.interactions).toHaveLength(1);
    });
});
