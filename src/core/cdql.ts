/**
 * CDQL (Cluaize Database Query Language) Builders
 * 
 * This file contains utility functions to generate CDQL strings
 * that the app will send to the Cluaiz Engine for execution.
 */

export const CDQLBuilders = {
    /**
     * Builds a CDQL query to fetch all chat sessions.
     */
    fetchSessions: (): string => {
        return `FIND Session() RETURN data`;
    },

    /**
     * Builds a CDQL query to create a new chat session neuron.
     */
    createSession: (sessionId: string, title: string): string => {
        return `INSERT Session(id: "${sessionId}", title: "${title}", createdAt: "${new Date().toISOString()}")`;
    },

    /**
     * Builds a CDQL query to insert a new message neuron and connect it to a session.
     */
    insertMessage: (sessionId: string, messageId: string, role: string, content: string): string => {
        // We use CDQL's capability to insert and connect in one go or sequentially.
        // Example syntax, assuming basic graph operations:
        return `
            INSERT Message(id: "${messageId}", role: "${role}", content: "${content.replace(/"/g, '\\"')}")
            MATCH s=Session(id: "${sessionId}"), m=Message(id: "${messageId}")
            CREATE EDGE (s)-[CONTAINS]->(m)
        `.trim();
    },

    /**
     * Builds a CDQL query to fetch messages for a specific session.
     */
    fetchMessages: (sessionId: string): string => {
        return `MATCH Session(id: "${sessionId}")-[CONTAINS]->(m:Message) RETURN m.data`;
    },

    /**
     * Builds a CDQL query to delete a session and its associated messages.
     */
    deleteSession: (sessionId: string): string => {
        return `
            MATCH Session(id: "${sessionId}")-[CONTAINS]->(m:Message) DELETE m
            MATCH s=Session(id: "${sessionId}") DELETE s
        `.trim();
    }
};
