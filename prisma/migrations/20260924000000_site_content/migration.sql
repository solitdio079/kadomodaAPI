CREATE TABLE "SiteContent" (
  "slug" TEXT NOT NULL,
  "draft" JSONB NOT NULL,
  "published" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("slug")
);
