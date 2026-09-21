-- AlterTable
ALTER TABLE "Play" ADD COLUMN "slug" TEXT;

-- Backfill human-readable unique slugs (name + short id suffix)
UPDATE "Play"
SET "slug" = lower(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(trim("name"), ' ', '-'),
            '--', '-'
          ),
          'á', 'a'
        ),
        'é', 'e'
      ),
      'í', 'i'
    ),
    'ó', 'o'
  )
) || '-' || substr("id", -5)
WHERE "slug" IS NULL OR "slug" = '';

-- Fallback if name was empty
UPDATE "Play" SET "slug" = 'play-' || substr("id", -8) WHERE "slug" IS NULL OR "slug" = '';

CREATE UNIQUE INDEX "Play_slug_key" ON "Play"("slug");
