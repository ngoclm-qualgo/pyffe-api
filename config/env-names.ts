export const ENVIRONMENTS = ['dev', 'qa'] as const;
export type TestEnv = (typeof ENVIRONMENTS)[number];
