"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchingDebugger = void 0;
/**
 * Matching Debugger - Helps understand why matches are made or rejected
 */
class MatchingDebugger {
    /**
     * Log a matching decision
     */
    static logDecision(internalProduct, externalProduct, source, decision, reason, score, breakdown) {
        this.logs.push({
            timestamp: new Date().toISOString(),
            internalProduct,
            externalProduct,
            source,
            decision,
            reason,
            score,
            breakdown
        });
        // Keep only last 100 logs to prevent memory issues
        if (this.logs.length > 100) {
            this.logs = this.logs.slice(-100);
        }
        // Console output for debugging
        const emoji = decision === 'MATCHED' ? '✅' : '❌';
        const scoreText = score ? ` (Score: ${score.toFixed(3)})` : '';
        console.log(`${emoji} ${decision}: "${externalProduct}" - ${reason}${scoreText}`);
    }
    /**
     * Get recent matching logs
     */
    static getRecentLogs(limit = 20) {
        return this.logs.slice(-limit).reverse();
    }
    /**
     * Get logs for a specific internal product
     */
    static getLogsForProduct(internalProductTitle) {
        return this.logs
            .filter(log => log.internalProduct.toLowerCase().includes(internalProductTitle.toLowerCase()))
            .reverse();
    }
    /**
     * Get matching statistics
     */
    static getMatchingStats() {
        const total = this.logs.length;
        const matched = this.logs.filter(log => log.decision === 'MATCHED').length;
        const rejected = this.logs.filter(log => log.decision === 'REJECTED').length;
        const recentLogs = this.logs.slice(-50);
        const averageScore = recentLogs
            .filter(log => log.score !== undefined)
            .reduce((sum, log, _, arr) => sum + (log.score / arr.length), 0);
        return {
            total,
            matched,
            rejected,
            matchRate: total > 0 ? (matched / total * 100).toFixed(1) + '%' : '0%',
            averageScore: averageScore.toFixed(3)
        };
    }
    /**
     * Clear all logs
     */
    static clearLogs() {
        this.logs = [];
        console.log('🧹 Matching debug logs cleared');
    }
    /**
     * Export logs for analysis
     */
    static exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }
}
exports.MatchingDebugger = MatchingDebugger;
MatchingDebugger.logs = [];
//# sourceMappingURL=MatchingDebugger.js.map