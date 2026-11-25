export type ProductKind = 'APPAREL' | 'FOOTWEAR' | 'FRAGRANCE' | 'ACCESSORY';

export interface ImageUrls {
  sm: string;
  md: string;
  lg: string;
}
export interface ProductImage {
  id: string;
  urls: ImageUrls;
  alt: string | null;
  color: string | null;
  width: number | null;
  height: number | null;
}

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameAm: string;
  kind: ProductKind;
  imageUrl: string | null;
  sizes: string[];
  sizeGuide: Record<string, string>[] | null;
  productCount?: number;
}

export interface ColorOption {
  name: string;
  hex: string | null;
}

export interface ProductCard {
  id: string;
  slug: string;
  nameEn: string;
  nameAm: string | null;
  brand: { slug: string; name: string } | null;
  category: { slug: string; kind: ProductKind };
  price: number;
  priceMax: number;
  compareAtPrice: number | null;
  badge: string | null;
  isNewArrival: boolean;
  inStock: boolean;
  colors: ColorOption[];
  images: ProductImage[];
  /** owner added proof photos (box, tags, receipt) */
  original?: boolean;
  /** can be ordered now, arrives later */
  preorder?: { note: string | null } | null;
  rating?: { average: number; count: number } | null;
}

export interface Variant {
  id: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number;
  available: number;
}

export interface Product extends Omit<ProductCard, 'category'> {
  category: Category;
  descriptionEn: string | null;
  descriptionAm: string | null;
  origin: string | null;
  material: string | null;
  fit: string | null;
  tikTokUrl: string | null;
  tikTokVideoId: string | null;
  proofs: { id: string; label: 'box' | 'tag' | 'receipt' | 'other'; urls: ProductImage['urls'] }[];
  sizes: string[];
  variants: Variant[];
  fragrance: {
    concentration: string | null;
    volumeMl: number | null;
    scentFamily: string | null;
    notesTop: string[];
    notesHeart: string[];
    notesBase: string[];
  } | null;
}

export interface ProductList {
  products: ProductCard[];
  page: number;
  total: number;
  hasMore: boolean;
}

export interface Facets {
  sizes: string[];
  colors: ColorOption[];
  brands: { slug: string; name: string }[];
  price: { min: number; max: number };
}

export interface PaymentMethodPublic {
  id: string;
  name: string;
  kind: 'wallet' | 'bank' | 'cash';
  accountName: string;
  accountNumber: string;
}

export interface DeliveryOptionPublic {
  id: string;
  nameEn: string;
  nameAm: string;
  noteEn: string;
  noteAm: string;
  fee: number | null;
  needsAddress: boolean;
}

export interface StoreSettings {
  storeName: string;
  phone: string;
  telegramInbox: string;
  telegramChannelUrl: string;
  tikTokHandle: string;
  addressEn: string;
  addressAm: string;
  mapLat: number | null;
  mapLng: number | null;
  openingHours: string;
  announcementEn: string;
  announcementAm: string;
  heroVideoUrl: string | null;
  heroImageUrl: string | null;
  partialPaymentEnabled: boolean;
  depositPercent: number;
  returnPolicyEn: string;
  returnPolicyAm: string;
}

export interface PublicConfig {
  store: StoreSettings;
  paymentMethods: PaymentMethodPublic[];
  deliveryOptions: DeliveryOptionPublic[];
  telegram: { botUsername: string };
}

export type Role = 'CUSTOMER' | 'ADMIN' | 'OWNER';

export interface User {
  id: string;
  role: Role;
  fullName: string;
  phone: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  photoUrl: string | null;
  languageCode: string;
  city: string | null;
  area: string | null;
  landmark: string | null;
  newsOptIn?: boolean;
  sizeProfile?: SizeProfile;
}

export interface SizeProfile {
  height?: number;
  weight?: number;
  fit?: 'slim' | 'regular' | 'loose';
  sizes: Record<string, string>;
}

export interface Review {
  id: string;
  rating: number;
  text: string | null;
  size: string;
  name: string;
  photos: { id: string; urls: ProductImage['urls'] }[];
  createdAt: string;
}
export interface ReviewSummary {
  average: number | null;
  count: number;
  distribution: number[];
  withPhotos: number;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PACKING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'PICKED_UP' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'SUBMITTED' | 'PARTIAL' | 'PAID' | 'REJECTED';

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  size: string;
  color: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  costPrice?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  /** staff only: a cancel waiting to take effect (undo window) */
  cancelAt?: string | null;
  paymentStatus: PaymentStatus;
  source: 'WEB' | 'MINI_APP' | 'ADMIN' | 'COUNTER';
  customerName: string;
  customerPhone: string;
  delivery: {
    optionId: string;
    label: string;
    city: string | null;
    area: string | null;
    landmark: string | null;
    lat: number | null;
    lng: number | null;
  };
  subtotal: number;
  discountTotal?: number;
  discounts?: { kind: 'bundle' | 'promo' | 'referral' | 'credit'; label: string; amount: number; code?: string }[];
  giftNote?: string | null;
  creditUsed?: number;
  /** customer only, while on the way: the code they give the driver */
  deliveryCode?: string | null;
  isPreorder?: boolean;
  driverId?: string | null;
  deliveryFee: number | null;
  total: number;
  amountDue: number;
  amountPaid: number;
  balance: number;
  isDeposit: boolean;
  payment: { methodId: string | null; label: string | null; transactionRef: string | null; proofUrl: string | null };
  note: string | null;
  items: OrderItem[];
  costTotal?: number;
  profit?: number;
  /** Staff only: result of the automatic payment check or a duplicate-receipt warning */
  paymentCheck?: string | null;
  events?: { id: string; type: string; message: string | null; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}
