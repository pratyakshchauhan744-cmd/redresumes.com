-- CreateTable
CREATE TABLE "public_resumes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "resume_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_resumes_pkey" PRIMARY KEY ("id")
);
