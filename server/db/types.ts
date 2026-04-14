// ── Enums ──────────────────────────────────────────────

export type ProductCategory =
  | 'fashion'
  | 'beauty'
  | 'food'
  | 'electronics'
  | 'lifestyle'
  | 'toys'
  | 'limited'
  | 'other'

export type ListingStatus = 'draft' | 'active' | 'inactive' | 'pending_approval'

export type InactiveReason = 'self' | 'expired' | 'admin' | 'product_removed'

export type ReviewStatus = 'visible' | 'hidden'

export type ReportStatus = 'pending' | 'resolved' | 'dismissed'

export type NotificationType =
  | 'review_received'
  | 'review_liked'
  | 'listing_removed_by_admin'
  | 'listing_republish_approved'
  | 'connection_removed_by_admin'
  | 'connection_republish_approved'
  | 'product_removed'
  | 'product_removed_creator'
  | 'account_action_taken'
  | 'new_listing_for_wish'
  | 'followed_seller_new_listing'
  | 'wish_product_removed'
  | 'bookmarked_product_removed'

export type ConnectionStatus = 'active' | 'ended' | 'pending_approval'

export type EndedReason = 'self' | 'expired' | 'admin'

// ── Composite Types ────────────────────────────────────

export type ListingSpec = {
  type: string
  is_custom: boolean
  options: string[]
  is_all: boolean
}

// ── Table Row Types ────────────────────────────────────

export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Seller = {
  id: string
  name: string
  phone_number: string
  phone_verified: boolean
  ig_handle: string | null
  threads_handle: string | null
  ig_follower_count: number | null
  threads_follower_count: number | null
  social_connected_at: string | null
  is_social_verified: boolean
  is_suspended: boolean
  suspended_at: string | null
  avg_rating: number | null
  review_count: number
  created_at: string
  updated_at: string
}

export type Region = {
  id: string
  name: string
}

export type SellerRegion = {
  seller_id: string
  region_id: string
}

export type Product = {
  id: string
  name: string
  brand: string | null
  category: ProductCategory | null
  catalog_image_id: string | null
  is_removed: boolean
  removed_at: string | null
  removed_by: string | null
  search_text: string
  wish_count: number
  created_by: string
  created_at: string
  updated_at: string
}

export type ProductImage = {
  id: string
  product_id: string
  r2_key: string
  url: string
  uploaded_by: string
  created_at: string
}

export type Listing = {
  id: string
  product_id: string
  seller_id: string
  status: ListingStatus
  inactive_reason: InactiveReason | null
  admin_note: string | null
  price: number | null
  is_price_on_request: boolean
  specs: ListingSpec[]
  note: string | null
  post_url: string
  shipping_days: number
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type ListingImage = {
  id: string
  listing_id: string
  r2_key: string
  url: string
  sort_order: number
  created_at: string
}

export type Review = {
  id: string
  seller_id: string
  reviewer_id: string
  rating: number
  comment: string | null
  seller_reply: string | null
  seller_replied_at: string | null
  status: ReviewStatus
  like_count: number
  created_at: string
  updated_at: string
}

export type ReviewLike = {
  id: string
  review_id: string
  user_id: string
  created_at: string
}

export type Report = {
  id: string
  reporter_id: string
  listing_id: string | null
  review_id: string | null
  connection_id: string | null
  seller_id: string | null
  reason: string
  status: ReportStatus
  admin_note: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

export type Notification = {
  id: string
  recipient_id: string
  type: NotificationType
  payload: Record<string, unknown>
  is_read: boolean
  created_at: string
}

export type ProductBookmark = {
  id: string
  user_id: string
  product_id: string
  created_at: string
}

export type ListingBookmark = {
  id: string
  user_id: string
  listing_id: string
  created_at: string
}

export type Follow = {
  id: string
  follower_id: string
  seller_id: string
  created_at: string
}

export type Connection = {
  id: string
  seller_id: string
  region_id: string
  sub_region: string | null
  start_date: string
  end_date: string
  description: string | null
  status: ConnectionStatus
  ended_reason: EndedReason | null
  admin_note: string | null
  created_at: string
  updated_at: string
}

export type ConnectionImage = {
  id: string
  connection_id: string
  r2_key: string
  url: string
  sort_order: number
  created_at: string
}

export type Wish = {
  id: string
  user_id: string
  product_id: string
  created_at: string
}

// ── Database Schema Type ───────────────────────────────

type TableDefinition<
  Row,
  Insert = Partial<Row>,
  Update = Partial<Row>,
> = {
  Row: Row
  Insert: Insert
  Update: Update
}

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        Profile,
        Omit<Profile, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string },
        Partial<Profile>
      >
      sellers: TableDefinition<
        Seller,
        Omit<Seller, 'id' | 'created_at' | 'updated_at' | 'avg_rating' | 'review_count' | 'is_suspended' | 'is_social_verified' | 'phone_verified'> & {
          id?: string
          created_at?: string
          updated_at?: string
          avg_rating?: number | null
          review_count?: number
          is_suspended?: boolean
          is_social_verified?: boolean
          phone_verified?: boolean
        },
        Partial<Seller>
      >
      regions: TableDefinition<
        Region,
        Omit<Region, 'id'> & { id?: string },
        Partial<Region>
      >
      seller_regions: TableDefinition<
        SellerRegion,
        SellerRegion,
        Partial<SellerRegion>
      >
      products: TableDefinition<
        Product,
        Omit<Product, 'id' | 'created_at' | 'updated_at' | 'is_removed' | 'wish_count' | 'search_text'> & {
          id?: string
          created_at?: string
          updated_at?: string
          is_removed?: boolean
          wish_count?: number
          search_text?: string
        },
        Partial<Product>
      >
      product_images: TableDefinition<
        ProductImage,
        Omit<ProductImage, 'id' | 'created_at'> & { id?: string; created_at?: string },
        Partial<ProductImage>
      >
      listings: TableDefinition<
        Listing,
        Omit<Listing, 'id' | 'created_at' | 'updated_at' | 'status' | 'is_price_on_request'> & {
          id?: string
          created_at?: string
          updated_at?: string
          status?: ListingStatus
          is_price_on_request?: boolean
        },
        Partial<Listing>
      >
      listing_images: TableDefinition<
        ListingImage,
        Omit<ListingImage, 'id' | 'created_at'> & { id?: string; created_at?: string },
        Partial<ListingImage>
      >
      reviews: TableDefinition<
        Review,
        Omit<Review, 'id' | 'created_at' | 'updated_at' | 'like_count' | 'status'> & {
          id?: string
          created_at?: string
          updated_at?: string
          like_count?: number
          status?: ReviewStatus
        },
        Partial<Review>
      >
      review_likes: TableDefinition<
        ReviewLike,
        Omit<ReviewLike, 'id' | 'created_at'> & { id?: string; created_at?: string },
        Partial<ReviewLike>
      >
      reports: TableDefinition<
        Report,
        Omit<Report, 'id' | 'created_at' | 'status'> & {
          id?: string
          created_at?: string
          status?: ReportStatus
        },
        Partial<Report>
      >
      notifications: TableDefinition<
        Notification,
        Omit<Notification, 'id' | 'created_at' | 'is_read'> & {
          id?: string
          created_at?: string
          is_read?: boolean
        },
        Partial<Notification>
      >
      product_bookmarks: TableDefinition<
        ProductBookmark,
        Omit<ProductBookmark, 'id' | 'created_at'> & { id?: string; created_at?: string },
        Partial<ProductBookmark>
      >
      listing_bookmarks: TableDefinition<
        ListingBookmark,
        Omit<ListingBookmark, 'id' | 'created_at'> & { id?: string; created_at?: string },
        Partial<ListingBookmark>
      >
      follows: TableDefinition<
        Follow,
        Omit<Follow, 'id' | 'created_at'> & { id?: string; created_at?: string },
        Partial<Follow>
      >
      connections: TableDefinition<
        Connection,
        Omit<Connection, 'id' | 'created_at' | 'updated_at' | 'status'> & {
          id?: string
          created_at?: string
          updated_at?: string
          status?: ConnectionStatus
        },
        Partial<Connection>
      >
      connection_images: TableDefinition<
        ConnectionImage,
        Omit<ConnectionImage, 'id' | 'created_at'> & { id?: string; created_at?: string },
        Partial<ConnectionImage>
      >
      wishes: TableDefinition<
        Wish,
        Omit<Wish, 'id' | 'created_at'> & { id?: string; created_at?: string },
        Partial<Wish>
      >
    }
  }
}
