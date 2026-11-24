import type { Category, ProductImage } from '../lib/types';

export interface AdminVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number | null;
  stock: number;
  isActive: boolean;
  /** customers waiting for this size ("Notify me when back") */
  _count?: { alerts: number };
}

export interface AdminProduct {
  id: string;
  slug: string;
  nameEn: string;
  nameAm: string | null;
  descriptionEn: string | null;
  descriptionAm: string | null;
  categoryId: string;
  category: Category;
  brand: { id: string; slug: string; name: string } | null;
  origin: string | null;
  material: string | null;
  fit: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isFeatured: boolean;
  isNewArrival: boolean;
  badge: string | null;
  tags: string[];
  concentration: string | null;
  volumeMl: number | null;
  scentFamily: string | null;
  notesTop: string[];
  notesHeart: string[];
  notesBase: string[];
  tikTokUrl: string | null;
  preorder: boolean;
  preorderNote: string | null;
  telegramPostUrl: string | null;
  images: ProductImage[];
  /** "Original" proof photos (box, tags, receipt) */
  proofs: { id: string; label: 'box' | 'tag' | 'receipt' | 'other'; urls: ProductImage['urls'] }[];
  ratingAvg?: number | null;
  ratingCount?: number;
  variants: AdminVariant[];
  totalStock: number;
  updatedAt: string;
}
