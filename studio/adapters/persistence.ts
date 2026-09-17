// Slack documents live only in the active editor. Never open a document database.
// Settings such as theme are independent; the engine's memory undo history is untouched.
export const createAutosaveDraftId = (): string => crypto.randomUUID();
export const saveAutosaveDraft = async (): Promise<never> => { throw new Error('Document autosave is disabled in Slack'); };
export const getAutosaveDraft = async (): Promise<null> => null;
export const listAutosaveDrafts = async (): Promise<never[]> => [];
export const deleteAutosaveDraft = async (): Promise<void> => {};
export const clearAutosaveDrafts = async (): Promise<void> => {};
export const addRecentDoc = async (): Promise<void> => {};
export const listRecentDocs = async (): Promise<never[]> => [];
export const removeRecentDoc = async (): Promise<void> => {};
export const clearRecentDocs = async (): Promise<void> => {};
export const listHistoryMeta = async (): Promise<never[]> => [];
export const getHistoryPayload = async (): Promise<null> => null;
export const saveHistoryIrSnapshot = async (): Promise<never> => { throw new Error('Document history is disabled in Slack'); };
export const deleteHistorySnapshot = async (): Promise<void> => {};
export const clearHistory = async (): Promise<void> => {};
