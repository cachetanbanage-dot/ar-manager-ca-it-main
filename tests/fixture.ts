// The sample data as ArData, read from tests/fixtures/sample.json (saved by
// scripts/snapshot.ts). Tests use this instead of the database, so they run
// offline and never change when test records are added to the workspace.
import { toArData, type DbRows } from '@/lib/ar/rows';
import sample from './fixtures/sample.json';

export const sampleData = toArData(sample as unknown as DbRows);
