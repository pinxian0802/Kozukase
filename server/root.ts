import { router } from './trpc'
import { authRouter } from './routers/auth'
import { productRouter } from './routers/product'
import { listingRouter } from './routers/listing'
import { sellerRouter } from './routers/seller'
import { reviewRouter } from './routers/review'
import { bookmarkRouter } from './routers/bookmark'
import { followRouter } from './routers/follow'
import { wishRouter } from './routers/wish'
import { connectionRouter } from './routers/connection'
import { notificationRouter } from './routers/notification'
import { reportRouter } from './routers/report'
import { uploadRouter } from './routers/upload'
import { adminRouter } from './routers/admin'

export const appRouter = router({
  auth: authRouter,
  product: productRouter,
  listing: listingRouter,
  seller: sellerRouter,
  review: reviewRouter,
  bookmark: bookmarkRouter,
  follow: followRouter,
  wish: wishRouter,
  connection: connectionRouter,
  notification: notificationRouter,
  report: reportRouter,
  upload: uploadRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
