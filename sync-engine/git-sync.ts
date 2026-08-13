import git from 'isomorphic-git';
import * as fs from 'fs';
import * as path from 'path';

export class GitSyncEngine {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    public async initializeSync(): Promise<void> {
        // Initializes git in the `.prompt` directory specifically or root project.
        // For a dedicated AI memory ledger, we can init a separate git repo inside `.prompt`
        // or just commit `.prompt` files to the main project repo.
        const repoPath = path.join(this.projectRoot, '.prompt');
        
        if (!fs.existsSync(path.join(repoPath, '.git'))) {
            await git.init({ fs, dir: repoPath });
        }
    }

    public async commitLedger(message: string): Promise<string> {
        const repoPath = path.join(this.projectRoot, '.prompt');
        
        // Add all ledger files
        await git.add({ fs, dir: repoPath, filepath: '.' });
        
        // Commit
        const sha = await git.commit({
            fs,
            dir: repoPath,
            author: {
                name: 'SyncDev AI Agent',
                email: 'agent@syncdev.local',
            },
            message: message || 'Auto-sync AI Ledger'
        });

        return sha;
    }

    public async pushLedger(remoteUrl: string, branch: string = 'main'): Promise<void> {
        const repoPath = path.join(this.projectRoot, '.prompt');
        
        await git.push({
            fs,
            http: require('isomorphic-git/http/node'), // Web/Mobile will use different http clients
            dir: repoPath,
            remote: 'origin',
            url: remoteUrl,
            ref: branch,
            force: true
        });
    }

    public async pullLedger(remoteUrl: string, branch: string = 'main'): Promise<void> {
        const repoPath = path.join(this.projectRoot, '.prompt');
        
        await git.pull({
            fs,
            http: require('isomorphic-git/http/node'),
            dir: repoPath,
            remote: 'origin',
            url: remoteUrl,
            ref: branch,
            singleBranch: true
        });
    }
}
