-- CreateEnum
CREATE TYPE "ServicePriceType" AS ENUM ('fixed', 'starting_at', 'range');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('pending_confirmation', 'confirmed', 'cancelled', 'completed', 'no_show');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('chat', 'admin');

-- CreateEnum
CREATE TYPE "ScheduleExceptionType" AS ENUM ('day_off', 'custom_hours');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'handed_off', 'closed');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system', 'human_agent');

-- CreateEnum
CREATE TYPE "PhotoPurpose" AS ENUM ('nail_reference', 'hair_desde_evaluation');

-- CreateEnum
CREATE TYPE "EscalationReason" AS ENUM ('facial_recommendation', 'laser_zone_confirmation', 'hair_desde_pricing', 'ai_uncertain', 'client_requested_human');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('open', 'resolved');

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specialist" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "photoUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specialist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceType" "ServicePriceType" NOT NULL DEFAULT 'fixed',
    "price" DECIMAL(10,2) NOT NULL,
    "priceMax" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "requiresConsultation" BOOLEAN NOT NULL DEFAULT false,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "defaultDurationMinutes" INTEGER NOT NULL,
    "sessionPackageSize" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistService" (
    "specialistId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "durationOverrideMinutes" INTEGER,

    CONSTRAINT "SpecialistService_pkey" PRIMARY KEY ("specialistId","serviceId")
);

-- CreateTable
CREATE TABLE "ScheduleRule" (
    "id" UUID NOT NULL,
    "specialistId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleConstraint" (
    "id" UUID NOT NULL,
    "specialistId" UUID,
    "serviceId" UUID,
    "serviceCategoryId" UUID,
    "dayOfWeek" INTEGER,
    "latestStartTime" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ScheduleConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" UUID NOT NULL,
    "specialistId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "ScheduleExceptionType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,

    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "specialistId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'pending_confirmation',
    "confirmationCode" TEXT NOT NULL,
    "notes" TEXT,
    "source" "AppointmentSource" NOT NULL DEFAULT 'chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentService" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "durationMinutesSnapshot" INTEGER NOT NULL,
    "priceSnapshot" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "clientId" UUID,
    "sessionToken" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentId" UUID,
    "toolCallMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoUpload" (
    "id" UUID NOT NULL,
    "conversationId" UUID,
    "appointmentId" UUID,
    "clientId" UUID NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "purpose" "PhotoPurpose" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationFlag" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "reason" "EscalationReason" NOT NULL,
    "status" "EscalationStatus" NOT NULL DEFAULT 'open',
    "assignedSpecialistId" UUID,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EscalationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "updatedByAdminId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermSynonym" (
    "id" UUID NOT NULL,
    "term" TEXT NOT NULL,
    "canonicalServiceId" UUID,
    "canonicalCategoryId" UUID,
    "notes" TEXT,

    CONSTRAINT "TermSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantPolicy" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_name_key" ON "ServiceCategory"("name");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- CreateIndex
CREATE INDEX "SpecialistService_serviceId_idx" ON "SpecialistService"("serviceId");

-- CreateIndex
CREATE INDEX "ScheduleRule_specialistId_dayOfWeek_idx" ON "ScheduleRule"("specialistId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ScheduleConstraint_specialistId_idx" ON "ScheduleConstraint"("specialistId");

-- CreateIndex
CREATE INDEX "ScheduleException_specialistId_date_idx" ON "ScheduleException"("specialistId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_confirmationCode_key" ON "Appointment"("confirmationCode");

-- CreateIndex
CREATE INDEX "Appointment_specialistId_date_startTime_idx" ON "Appointment"("specialistId", "date", "startTime");

-- CreateIndex
CREATE INDEX "Appointment_confirmationCode_idx" ON "Appointment"("confirmationCode");

-- CreateIndex
CREATE INDEX "AppointmentService_appointmentId_idx" ON "AppointmentService"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_sessionToken_key" ON "Conversation"("sessionToken");

-- CreateIndex
CREATE INDEX "Conversation_sessionToken_idx" ON "Conversation"("sessionToken");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "PhotoUpload_clientId_idx" ON "PhotoUpload"("clientId");

-- CreateIndex
CREATE INDEX "EscalationFlag_status_idx" ON "EscalationFlag"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_key_key" ON "Credential"("key");

-- CreateIndex
CREATE INDEX "TermSynonym_term_idx" ON "TermSynonym"("term");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantPolicy_key_key" ON "AssistantPolicy"("key");

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistService" ADD CONSTRAINT "SpecialistService_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistService" ADD CONSTRAINT "SpecialistService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRule" ADD CONSTRAINT "ScheduleRule_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleConstraint" ADD CONSTRAINT "ScheduleConstraint_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleConstraint" ADD CONSTRAINT "ScheduleConstraint_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleConstraint" ADD CONSTRAINT "ScheduleConstraint_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "PhotoUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoUpload" ADD CONSTRAINT "PhotoUpload_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoUpload" ADD CONSTRAINT "PhotoUpload_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoUpload" ADD CONSTRAINT "PhotoUpload_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationFlag" ADD CONSTRAINT "EscalationFlag_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationFlag" ADD CONSTRAINT "EscalationFlag_assignedSpecialistId_fkey" FOREIGN KEY ("assignedSpecialistId") REFERENCES "Specialist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermSynonym" ADD CONSTRAINT "TermSynonym_canonicalServiceId_fkey" FOREIGN KEY ("canonicalServiceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermSynonym" ADD CONSTRAINT "TermSynonym_canonicalCategoryId_fkey" FOREIGN KEY ("canonicalCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
