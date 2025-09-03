/**
 * Matching Debugger - Helps understand why matches are made or rejected
 */
export declare class MatchingDebugger {
    private static logs;
    /**
     * Log a matching decision
     */
    static logDecision(internalProduct: string, externalProduct: string, source: string, decision: 'MATCHED' | 'REJECTED', reason: string, score?: number, breakdown?: any): void;
    /**
     * Get recent matching logs
     */
    static getRecentLogs(limit?: number): {
        timestamp: string;
        internalProduct: string;
        externalProduct: string;
        source: string;
        decision: "MATCHED" | "REJECTED";
        reason: string;
        score?: number;
        breakdown?: any;
    }[];
    /**
     * Get logs for a specific internal product
     */
    static getLogsForProduct(internalProductTitle: string): {
        timestamp: string;
        internalProduct: string;
        externalProduct: string;
        source: string;
        decision: "MATCHED" | "REJECTED";
        reason: string;
        score?: number;
        breakdown?: any;
    }[];
    /**
     * Get matching statistics
     */
    static getMatchingStats(): {
        total: number;
        matched: number;
        rejected: number;
        matchRate: string;
        averageScore: string;
    };
    /**
     * Clear all logs
     */
    static clearLogs(): void;
    /**
     * Export logs for analysis
     */
    static exportLogs(): string;
}
//# sourceMappingURL=MatchingDebugger.d.ts.map