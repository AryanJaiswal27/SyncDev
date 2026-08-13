import * as fs from 'fs';
import * as path from 'path';

export interface Interaction {
    timestamp: string;
    userPrompt: string;
    agentAction: string;
    agentPayload: string;
}

export interface SessionMemory {
    projectId: string;
    systemPrompt: string;
    history: Interaction[];
    context: Record<string, string>;
}

export class LedgerManager {
    private projectRoot: string;
    private promptDir: string;
    private ledgerPath: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        this.promptDir = path.join(this.projectRoot, '.prompt');
        this.ledgerPath = path.join(this.promptDir, 'ledger.json');
    }

    public async initLedger(initialState: SessionMemory): Promise<void> {
        if (!fs.existsSync(this.promptDir)) {
            fs.mkdirSync(this.promptDir, { recursive: true });
        }
        if (!fs.existsSync(this.ledgerPath)) {
            await this.saveLedger(initialState);
        }
    }

    public async getLedger(): Promise<SessionMemory | null> {
        if (!fs.existsSync(this.ledgerPath)) return null;
        const data = fs.readFileSync(this.ledgerPath, 'utf8');
        return JSON.parse(data) as SessionMemory;
    }

    public async saveLedger(memory: SessionMemory): Promise<void> {
        fs.writeFileSync(this.ledgerPath, JSON.stringify(memory, null, 2), 'utf8');
    }

    public async appendInteraction(interaction: Interaction): Promise<void> {
        const ledger = await this.getLedger();
        if (ledger) {
            ledger.history.push(interaction);
            await this.saveLedger(ledger);
        }
    }
}
