--
-- PostgreSQL database dump
--

\restrict Yp5EDlqD6vCVF02YnQOLzTNc0ieniu7eUVv1eQGeNUHSRpJyThGl5XkKLQMbg40

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: client_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    share_data_with_restaurants boolean DEFAULT true NOT NULL,
    allow_ai_memory boolean DEFAULT true NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    accessibility_needs text[] DEFAULT '{}'::text[] NOT NULL
    ,discovery_preferences jsonb DEFAULT '[]'::jsonb NOT NULL
    ,saved_addresses jsonb DEFAULT '[]'::jsonb NOT NULL
    ,gender text
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id text NOT NULL,
    name text NOT NULL,
    razao_social text,
    cnpj text,
    email text NOT NULL,
    phone text,
    address text,
    owner_name text NOT NULL,
    logo_url text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_tokens (
    id text NOT NULL,
    company_id text NOT NULL,
    employee_id text NOT NULL,
    token text NOT NULL,
    role text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: feed_publication_moderation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_publication_moderation (
    post_id text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    report_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feed_publication_moderation_status_check CHECK ((status = ANY (ARRAY['active'::text, 'under_review'::text, 'removed'::text])))
);


--
-- Name: feed_publication_moderation_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_publication_moderation_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id text NOT NULL,
    moderator_id text NOT NULL,
    decision text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feed_publication_moderation_decisions_decision_check CHECK ((decision = ANY (ARRAY['substantiated'::text, 'dismissed'::text])))
);


--
-- Name: feed_publication_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_publication_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id text NOT NULL,
    reporter_client_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: login_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_devices (
    id text NOT NULL,
    owner_id text NOT NULL,
    device_id text NOT NULL,
    device_name text,
    user_agent text,
    ip_address text,
    fingerprint text,
    trust_level text DEFAULT 'unknown'::text NOT NULL,
    alert_sent boolean DEFAULT false NOT NULL,
    last_login_at timestamp with time zone,
    first_login_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: otp_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_tokens (
    id text NOT NULL,
    owner_id text NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: owner_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_accounts (
    id text NOT NULL,
    company_id text NOT NULL,
    email text NOT NULL,
    phone text,
    password_hash text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Recuperação de senha: código é armazenado somente como hash.
CREATE TABLE public.password_recovery_codes (
    id text NOT NULL,
    owner_id text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    used_at timestamp with time zone,
    reset_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pending_owner_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_owner_registrations (
    id text NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    company_name text NOT NULL,
    cnpj text,
    email text NOT NULL,
    address text,
    owner_name text NOT NULL,
    password_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: phone_otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_otp_codes (
    id text NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: phone_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_users (
    id text NOT NULL,
    phone text NOT NULL,
    name text,
    role text DEFAULT 'client'::text NOT NULL,
    company_id text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: restaurant_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_registrations (
    id text NOT NULL,
    name text NOT NULL,
    cnpj text,
    email text NOT NULL,
    phone text,
    address text,
    cuisine text,
    owner_name text,
    declared_prep_time integer DEFAULT 20,
    avg_actual_prep_time numeric,
    consecutive_failures integer DEFAULT 0,
    performance_score numeric DEFAULT 5.0,
    status text DEFAULT 'pendente'::text,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: store_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_snapshots (
    key text NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: client_accounts client_accounts_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_accounts
    ADD CONSTRAINT client_accounts_email_key UNIQUE (email);


--
-- Name: client_accounts client_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_accounts
    ADD CONSTRAINT client_accounts_pkey PRIMARY KEY (id);


--
-- Name: companies companies_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_email_unique UNIQUE (email);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: employee_tokens employee_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_tokens
    ADD CONSTRAINT employee_tokens_pkey PRIMARY KEY (id);


--
-- Name: employee_tokens employee_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_tokens
    ADD CONSTRAINT employee_tokens_token_unique UNIQUE (token);


--
-- Name: feed_publication_moderation_decisions feed_publication_moderation_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_publication_moderation_decisions
    ADD CONSTRAINT feed_publication_moderation_decisions_pkey PRIMARY KEY (id);


--
-- Name: feed_publication_moderation feed_publication_moderation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_publication_moderation
    ADD CONSTRAINT feed_publication_moderation_pkey PRIMARY KEY (post_id);


--
-- Name: feed_publication_reports feed_publication_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_publication_reports
    ADD CONSTRAINT feed_publication_reports_pkey PRIMARY KEY (id);


--
-- Name: login_devices login_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_devices
    ADD CONSTRAINT login_devices_pkey PRIMARY KEY (id);


--
-- Name: otp_tokens otp_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_tokens
    ADD CONSTRAINT otp_tokens_pkey PRIMARY KEY (id);


--
-- Name: owner_accounts owner_accounts_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_accounts
    ADD CONSTRAINT owner_accounts_email_unique UNIQUE (email);


--
-- Name: owner_accounts owner_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_accounts
    ADD CONSTRAINT owner_accounts_pkey PRIMARY KEY (id);


--
-- Name: pending_owner_registrations pending_owner_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_owner_registrations
    ADD CONSTRAINT pending_owner_registrations_pkey PRIMARY KEY (id);


--
-- Name: phone_otp_codes phone_otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_otp_codes
    ADD CONSTRAINT phone_otp_codes_pkey PRIMARY KEY (id);


--
-- Name: phone_users phone_users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_users
    ADD CONSTRAINT phone_users_phone_key UNIQUE (phone);


--
-- Name: phone_users phone_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_users
    ADD CONSTRAINT phone_users_pkey PRIMARY KEY (id);


--
-- Name: restaurant_registrations restaurant_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_registrations
    ADD CONSTRAINT restaurant_registrations_pkey PRIMARY KEY (id);


--
-- Name: store_snapshots store_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_snapshots
    ADD CONSTRAINT store_snapshots_pkey PRIMARY KEY (key);


--
-- Name: client_accounts_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_accounts_email_idx ON public.client_accounts USING btree (email);


--
-- Name: client_accounts_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_accounts_phone_idx ON public.client_accounts USING btree (phone) WHERE (phone IS NOT NULL);


--
-- Name: employee_tokens employee_tokens_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_tokens
    ADD CONSTRAINT employee_tokens_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: login_devices login_devices_owner_id_owner_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_devices
    ADD CONSTRAINT login_devices_owner_id_owner_accounts_id_fk FOREIGN KEY (owner_id) REFERENCES public.owner_accounts(id) ON DELETE CASCADE;


--
-- Name: otp_tokens otp_tokens_owner_id_owner_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_tokens
    ADD CONSTRAINT otp_tokens_owner_id_owner_accounts_id_fk FOREIGN KEY (owner_id) REFERENCES public.owner_accounts(id) ON DELETE CASCADE;


--
-- Name: owner_accounts owner_accounts_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_accounts
    ADD CONSTRAINT owner_accounts_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Yp5EDlqD6vCVF02YnQOLzTNc0ieniu7eUVv1eQGeNUHSRpJyThGl5XkKLQMbg40
