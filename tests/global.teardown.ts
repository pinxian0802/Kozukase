import { test as teardown } from '@playwright/test'
import { purgeE2EData, restoreGlobalState } from './helpers/cleanup'

teardown('purge all e2e data', async () => {
  await restoreGlobalState()
  await purgeE2EData()
})
