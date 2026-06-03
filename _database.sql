--
-- PostgreSQL database dump
--

\restrict DXCMjmpKWLpEcP8OVYOO6HpMAglC3lotKyKX2eWoEgifSiqFgybI8k4EAulF2th

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

-- Started on 2026-06-03 16:50:16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 266 (class 1255 OID 33068)
-- Name: set_bill_id_for_device_issue(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_bill_id_for_device_issue() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT bill_id
    INTO NEW.bill_id
    FROM devices
    WHERE device_id = NEW.device_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_bill_id_for_device_issue() OWNER TO postgres;

--
-- TOC entry 267 (class 1255 OID 33070)
-- Name: set_bill_id_for_issue_history(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_bill_id_for_issue_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT bill_id
    INTO NEW.bill_id
    FROM device_issues
    WHERE issue_id = NEW.issue_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_bill_id_for_issue_history() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 230 (class 1259 OID 24683)
-- Name: bills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bills (
    bill_id integer NOT NULL,
    invoice_number character varying(100),
    vendor_name character varying(200),
    gstin character varying(20),
    bill_date date,
    total_amount numeric,
    tax_amount numeric,
    created_at timestamp without time zone DEFAULT now(),
    stock_entry character varying,
    path character varying
);


ALTER TABLE public.bills OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 24682)
-- Name: bills_bill_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bills_bill_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bills_bill_id_seq OWNER TO postgres;

--
-- TOC entry 5374 (class 0 OID 0)
-- Dependencies: 229
-- Name: bills_bill_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bills_bill_id_seq OWNED BY public.bills.bill_id;


--
-- TOC entry 254 (class 1259 OID 33289)
-- Name: device_code_counters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_code_counters (
    id integer NOT NULL,
    lab_id character varying(50) NOT NULL,
    device_type character varying(50) NOT NULL,
    last_number integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.device_code_counters OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 33288)
-- Name: device_code_counters_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.device_code_counters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.device_code_counters_id_seq OWNER TO postgres;

--
-- TOC entry 5377 (class 0 OID 0)
-- Dependencies: 253
-- Name: device_code_counters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.device_code_counters_id_seq OWNED BY public.device_code_counters.id;


--
-- TOC entry 237 (class 1259 OID 24802)
-- Name: device_issue_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_issue_history (
    history_id integer NOT NULL,
    issue_id integer,
    action character varying(100) NOT NULL,
    old_status character varying(20),
    new_status character varying(20),
    note text,
    changed_at timestamp without time zone DEFAULT now(),
    bill_id integer,
    changed_by character varying(100)
);


ALTER TABLE public.device_issue_history OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 24801)
-- Name: device_issue_history_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.device_issue_history_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.device_issue_history_history_id_seq OWNER TO postgres;

--
-- TOC entry 5380 (class 0 OID 0)
-- Dependencies: 236
-- Name: device_issue_history_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.device_issue_history_history_id_seq OWNED BY public.device_issue_history.history_id;


--
-- TOC entry 235 (class 1259 OID 24784)
-- Name: device_issues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_issues (
    issue_id integer NOT NULL,
    device_id integer,
    issue_title character varying(150) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'Open'::character varying,
    reported_at timestamp without time zone DEFAULT now(),
    resolved_at timestamp without time zone,
    bill_id integer,
    severity character varying(20) DEFAULT 'medium'::character varying,
    reported_by character varying(100) DEFAULT 'System'::character varying
);


ALTER TABLE public.device_issues OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 24783)
-- Name: device_issues_issue_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.device_issues_issue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.device_issues_issue_id_seq OWNER TO postgres;

--
-- TOC entry 5383 (class 0 OID 0)
-- Dependencies: 234
-- Name: device_issues_issue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.device_issues_issue_id_seq OWNED BY public.device_issues.issue_id;


--
-- TOC entry 232 (class 1259 OID 24694)
-- Name: devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.devices (
    device_id integer NOT NULL,
    asset_code character varying(100),
    type_id integer NOT NULL,
    brand character varying(100),
    model character varying(100),
    specification text,
    unit_price numeric,
    purchase_date date,
    bill_id integer,
    lab_id character varying(50),
    warranty_years integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    invoice_number character varying(15) CONSTRAINT devices_invoice_no_not_null NOT NULL,
    dept character varying,
    qr_value text,
    assigned_code character varying,
    central_store_no character varying,
    central_store_date character varying,
    order_no character varying,
    order_date character varying,
    remarks character varying
);


ALTER TABLE public.devices OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 24693)
-- Name: devices_device_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.devices_device_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.devices_device_id_seq OWNER TO postgres;

--
-- TOC entry 5386 (class 0 OID 0)
-- Dependencies: 231
-- Name: devices_device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.devices_device_id_seq OWNED BY public.devices.device_id;


--
-- TOC entry 263 (class 1259 OID 33492)
-- Name: email_verification_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_verification_codes (
    id integer NOT NULL,
    email text NOT NULL,
    code_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    attempts integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.email_verification_codes OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 33491)
-- Name: email_verification_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_verification_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_verification_codes_id_seq OWNER TO postgres;

--
-- TOC entry 5389 (class 0 OID 0)
-- Dependencies: 262
-- Name: email_verification_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_verification_codes_id_seq OWNED BY public.email_verification_codes.id;


--
-- TOC entry 228 (class 1259 OID 24624)
-- Name: equipment_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipment_types (
    type_id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.equipment_types OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 24623)
-- Name: equipment_types_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipment_types_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipment_types_type_id_seq OWNER TO postgres;

--
-- TOC entry 5392 (class 0 OID 0)
-- Dependencies: 227
-- Name: equipment_types_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipment_types_type_id_seq OWNED BY public.equipment_types.type_id;


--
-- TOC entry 244 (class 1259 OID 24912)
-- Name: lab_equipment_pool; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_equipment_pool (
    id integer NOT NULL,
    lab_id character varying(50),
    equipment_type character varying(50),
    brand character varying(100),
    model character varying(100),
    specification text,
    quantity_added integer,
    quantity_assigned integer DEFAULT 0,
    invoice_number character varying(100),
    bill_id integer,
    unit_price numeric(10,2),
    purchase_date date,
    is_standby boolean DEFAULT false,
    linked_group_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lab_equipment_pool OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 24911)
-- Name: lab_equipment_pool_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lab_equipment_pool_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_equipment_pool_id_seq OWNER TO postgres;

--
-- TOC entry 5395 (class 0 OID 0)
-- Dependencies: 243
-- Name: lab_equipment_pool_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lab_equipment_pool_id_seq OWNED BY public.lab_equipment_pool.id;


--
-- TOC entry 233 (class 1259 OID 24725)
-- Name: lab_grid_cells; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_grid_cells (
    cell_id integer NOT NULL,
    lab_id character varying(50),
    row_number integer NOT NULL,
    column_number integer NOT NULL,
    assigned_code character varying(100),
    equipment_type character varying(50),
    os_windows boolean DEFAULT false,
    os_linux boolean DEFAULT false,
    os_other boolean DEFAULT false,
    is_empty boolean DEFAULT true,
    station_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lab_grid_cells OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 24850)
-- Name: lab_grid_cells_cell_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lab_grid_cells_cell_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_grid_cells_cell_id_seq OWNER TO postgres;

--
-- TOC entry 5398 (class 0 OID 0)
-- Dependencies: 238
-- Name: lab_grid_cells_cell_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lab_grid_cells_cell_id_seq OWNED BY public.lab_grid_cells.cell_id;


--
-- TOC entry 252 (class 1259 OID 33105)
-- Name: lab_layout_cells; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_layout_cells (
    cell_id integer NOT NULL,
    layout_id integer NOT NULL,
    row_number integer NOT NULL,
    column_number integer NOT NULL,
    station_type_id integer,
    label character varying(100),
    is_empty boolean DEFAULT true,
    os_windows boolean DEFAULT false,
    os_linux boolean DEFAULT false,
    os_other boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lab_layout_cells OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 33104)
-- Name: lab_layout_cells_cell_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lab_layout_cells_cell_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_layout_cells_cell_id_seq OWNER TO postgres;

--
-- TOC entry 5401 (class 0 OID 0)
-- Dependencies: 251
-- Name: lab_layout_cells_cell_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lab_layout_cells_cell_id_seq OWNED BY public.lab_layout_cells.cell_id;


--
-- TOC entry 250 (class 1259 OID 33088)
-- Name: lab_layout_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_layout_templates (
    layout_id integer NOT NULL,
    layout_name character varying(100) NOT NULL,
    description text,
    rows integer DEFAULT 6 NOT NULL,
    columns integer DEFAULT 6 NOT NULL,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lab_layout_templates OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 33087)
-- Name: lab_layout_templates_layout_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lab_layout_templates_layout_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_layout_templates_layout_id_seq OWNER TO postgres;

--
-- TOC entry 5404 (class 0 OID 0)
-- Dependencies: 249
-- Name: lab_layout_templates_layout_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lab_layout_templates_layout_id_seq OWNED BY public.lab_layout_templates.layout_id;


--
-- TOC entry 242 (class 1259 OID 24890)
-- Name: lab_station_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_station_devices (
    id integer NOT NULL,
    station_id integer,
    device_id integer,
    device_type character varying(50),
    brand character varying(100),
    model character varying(100),
    specification text,
    invoice_number character varying(100),
    bill_id integer,
    is_linked boolean DEFAULT false,
    linked_group_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lab_station_devices OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 24889)
-- Name: lab_station_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lab_station_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_station_devices_id_seq OWNER TO postgres;

--
-- TOC entry 5407 (class 0 OID 0)
-- Dependencies: 241
-- Name: lab_station_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lab_station_devices_id_seq OWNED BY public.lab_station_devices.id;


--
-- TOC entry 240 (class 1259 OID 24874)
-- Name: lab_stations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_stations (
    station_id integer NOT NULL,
    lab_id character varying(50),
    assigned_code character varying(100),
    row_number integer,
    column_number integer,
    created_at timestamp without time zone DEFAULT now(),
    station_qr_value text
);


ALTER TABLE public.lab_stations OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 24873)
-- Name: lab_stations_station_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lab_stations_station_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_stations_station_id_seq OWNER TO postgres;

--
-- TOC entry 5410 (class 0 OID 0)
-- Dependencies: 239
-- Name: lab_stations_station_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lab_stations_station_id_seq OWNED BY public.lab_stations.station_id;


--
-- TOC entry 226 (class 1259 OID 24602)
-- Name: labs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.labs (
    id integer NOT NULL,
    lab_id character varying(15) NOT NULL,
    lab_name character varying(125) NOT NULL,
    rows integer NOT NULL,
    columns integer NOT NULL,
    layout_id integer,
    lab_public_token text
);


ALTER TABLE public.labs OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 24601)
-- Name: labs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.labs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.labs_id_seq OWNER TO postgres;

--
-- TOC entry 5413 (class 0 OID 0)
-- Dependencies: 225
-- Name: labs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.labs_id_seq OWNED BY public.labs.id;


--
-- TOC entry 222 (class 1259 OID 16411)
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16410)
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO postgres;

--
-- TOC entry 5416 (class 0 OID 0)
-- Dependencies: 221
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- TOC entry 255 (class 1259 OID 33345)
-- Name: scrap_register; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scrap_register (
    scrap_id uuid NOT NULL,
    device_id integer NOT NULL,
    asset_code text,
    device_type text,
    brand text,
    model text,
    specification text,
    lab_id text,
    station_code text,
    scrapped_by_text text,
    scrapped_by_user_id integer,
    scrapped_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.scrap_register OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 33408)
-- Name: scrap_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scrap_requests (
    scrap_request_id integer NOT NULL,
    device_ids jsonb NOT NULL,
    lab_id text,
    status text DEFAULT 'pending'::text,
    remark text,
    requested_by text,
    requested_by_user_id integer,
    requested_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    approved_by text,
    approved_at timestamp with time zone
);


ALTER TABLE public.scrap_requests OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 33417)
-- Name: scrap_requests_scrap_request_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.scrap_requests_scrap_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scrap_requests_scrap_request_id_seq OWNER TO postgres;

--
-- TOC entry 5420 (class 0 OID 0)
-- Dependencies: 259
-- Name: scrap_requests_scrap_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scrap_requests_scrap_request_id_seq OWNED BY public.scrap_requests.scrap_request_id;


--
-- TOC entry 256 (class 1259 OID 33353)
-- Name: scrapped_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scrapped_devices (
    id integer NOT NULL,
    device_id integer NOT NULL,
    lab_id character varying(50) NOT NULL,
    station_id integer,
    scrapped_by integer,
    scrapped_at timestamp without time zone DEFAULT now(),
    reason text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    asset_code text,
    device_type text,
    brand text,
    model text,
    specification text,
    station_code text,
    scrapped_by_text text,
    scrapped_by_user_id integer,
    lab_name text,
    dead_stock_number text,
    cost numeric,
    justification_for_scrapping text,
    scrap_id character varying
);


ALTER TABLE public.scrapped_devices OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 33364)
-- Name: scrapped_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.scrapped_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scrapped_devices_id_seq OWNER TO postgres;

--
-- TOC entry 5423 (class 0 OID 0)
-- Dependencies: 257
-- Name: scrapped_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scrapped_devices_id_seq OWNED BY public.scrapped_devices.id;


--
-- TOC entry 248 (class 1259 OID 33073)
-- Name: station_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.station_types (
    station_type_id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    icon character varying(10),
    color character varying(20) DEFAULT '#3B82F6'::character varying,
    allowed_device_types text[],
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.station_types OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 33072)
-- Name: station_types_station_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.station_types_station_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.station_types_station_type_id_seq OWNER TO postgres;

--
-- TOC entry 5426 (class 0 OID 0)
-- Dependencies: 247
-- Name: station_types_station_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.station_types_station_type_id_seq OWNED BY public.station_types.station_type_id;


--
-- TOC entry 265 (class 1259 OID 33510)
-- Name: student_email_verification_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_email_verification_codes (
    id integer NOT NULL,
    email text NOT NULL,
    code_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    attempts integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.student_email_verification_codes OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 33509)
-- Name: student_email_verification_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.student_email_verification_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_email_verification_codes_id_seq OWNER TO postgres;

--
-- TOC entry 5429 (class 0 OID 0)
-- Dependencies: 264
-- Name: student_email_verification_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.student_email_verification_codes_id_seq OWNED BY public.student_email_verification_codes.id;


--
-- TOC entry 261 (class 1259 OID 33446)
-- Name: student_issue_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_issue_requests (
    request_id bigint NOT NULL,
    lab_id character varying(50) NOT NULL,
    station_id integer,
    device_id integer NOT NULL,
    student_name character varying(150) NOT NULL,
    student_email character varying(255) NOT NULL,
    issue_title character varying(255) NOT NULL,
    issue_description text,
    severity character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    approved_by character varying(150),
    approved_at timestamp without time zone,
    approved_issue_id integer,
    rejection_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_issue_requests_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT student_issue_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.student_issue_requests OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 33445)
-- Name: student_issue_requests_request_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.student_issue_requests_request_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_issue_requests_request_id_seq OWNER TO postgres;

--
-- TOC entry 5432 (class 0 OID 0)
-- Dependencies: 260
-- Name: student_issue_requests_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.student_issue_requests_request_id_seq OWNED BY public.student_issue_requests.request_id;


--
-- TOC entry 246 (class 1259 OID 33028)
-- Name: transfer_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transfer_requests (
    transfer_id integer NOT NULL,
    from_lab_id character varying NOT NULL,
    to_lab_id character varying NOT NULL,
    device_ids jsonb NOT NULL,
    remark text,
    status character varying(20) DEFAULT 'pending'::character varying,
    requested_by character varying(200),
    requested_at timestamp without time zone DEFAULT now(),
    approved_by character varying(200),
    approved_at timestamp without time zone,
    transfer_type character varying(20) DEFAULT 'individual'::character varying,
    station_ids text,
    dest_cell_id integer,
    device_dest_map text,
    CONSTRAINT different_labs CHECK (((from_lab_id)::text <> (to_lab_id)::text)),
    CONSTRAINT transfer_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.transfer_requests OWNER TO postgres;

--
-- TOC entry 5434 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE transfer_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.transfer_requests IS 'Manages device transfer requests between labs with HOD approval workflow';


--
-- TOC entry 5435 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN transfer_requests.device_ids; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transfer_requests.device_ids IS 'JSON array of device IDs to be transferred';


--
-- TOC entry 5436 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN transfer_requests.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transfer_requests.status IS 'Transfer status: pending, approved, or rejected';


--
-- TOC entry 245 (class 1259 OID 33027)
-- Name: transfer_requests_transfer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transfer_requests_transfer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transfer_requests_transfer_id_seq OWNER TO postgres;

--
-- TOC entry 5438 (class 0 OID 0)
-- Dependencies: 245
-- Name: transfer_requests_transfer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transfer_requests_transfer_id_seq OWNED BY public.transfer_requests.transfer_id;


--
-- TOC entry 224 (class 1259 OID 16431)
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer,
    session_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_accessed timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16430)
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5441 (class 0 OID 0)
-- Dependencies: 223
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- TOC entry 220 (class 1259 OID 16390)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(50) NOT NULL,
    assigned_lab character varying(100),
    access_scope jsonb,
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    email_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_login timestamp with time zone,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['HOD'::character varying, 'Lab Assistant'::character varying, 'Lab Incharge'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5444 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4987 (class 2604 OID 33418)
-- Name: bills bill_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills ALTER COLUMN bill_id SET DEFAULT nextval('public.bills_bill_id_seq'::regclass);


--
-- TOC entry 5033 (class 2604 OID 33419)
-- Name: device_code_counters id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_code_counters ALTER COLUMN id SET DEFAULT nextval('public.device_code_counters_id_seq'::regclass);


--
-- TOC entry 5004 (class 2604 OID 33420)
-- Name: device_issue_history history_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_issue_history ALTER COLUMN history_id SET DEFAULT nextval('public.device_issue_history_history_id_seq'::regclass);


--
-- TOC entry 4999 (class 2604 OID 33421)
-- Name: device_issues issue_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_issues ALTER COLUMN issue_id SET DEFAULT nextval('public.device_issues_issue_id_seq'::regclass);


--
-- TOC entry 4989 (class 2604 OID 33422)
-- Name: devices device_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices ALTER COLUMN device_id SET DEFAULT nextval('public.devices_device_id_seq'::regclass);


--
-- TOC entry 5048 (class 2604 OID 33495)
-- Name: email_verification_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verification_codes ALTER COLUMN id SET DEFAULT nextval('public.email_verification_codes_id_seq'::regclass);


--
-- TOC entry 4986 (class 2604 OID 33423)
-- Name: equipment_types type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_types ALTER COLUMN type_id SET DEFAULT nextval('public.equipment_types_type_id_seq'::regclass);


--
-- TOC entry 5011 (class 2604 OID 33424)
-- Name: lab_equipment_pool id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_equipment_pool ALTER COLUMN id SET DEFAULT nextval('public.lab_equipment_pool_id_seq'::regclass);


--
-- TOC entry 4993 (class 2604 OID 33425)
-- Name: lab_grid_cells cell_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_grid_cells ALTER COLUMN cell_id SET DEFAULT nextval('public.lab_grid_cells_cell_id_seq'::regclass);


--
-- TOC entry 5027 (class 2604 OID 33426)
-- Name: lab_layout_cells cell_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_layout_cells ALTER COLUMN cell_id SET DEFAULT nextval('public.lab_layout_cells_cell_id_seq'::regclass);


--
-- TOC entry 5022 (class 2604 OID 33427)
-- Name: lab_layout_templates layout_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_layout_templates ALTER COLUMN layout_id SET DEFAULT nextval('public.lab_layout_templates_layout_id_seq'::regclass);


--
-- TOC entry 5008 (class 2604 OID 33428)
-- Name: lab_station_devices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_station_devices ALTER COLUMN id SET DEFAULT nextval('public.lab_station_devices_id_seq'::regclass);


--
-- TOC entry 5006 (class 2604 OID 33429)
-- Name: lab_stations station_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_stations ALTER COLUMN station_id SET DEFAULT nextval('public.lab_stations_station_id_seq'::regclass);


--
-- TOC entry 4985 (class 2604 OID 33430)
-- Name: labs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs ALTER COLUMN id SET DEFAULT nextval('public.labs_id_seq'::regclass);


--
-- TOC entry 4979 (class 2604 OID 33431)
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- TOC entry 5041 (class 2604 OID 33432)
-- Name: scrap_requests scrap_request_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scrap_requests ALTER COLUMN scrap_request_id SET DEFAULT nextval('public.scrap_requests_scrap_request_id_seq'::regclass);


--
-- TOC entry 5037 (class 2604 OID 33433)
-- Name: scrapped_devices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scrapped_devices ALTER COLUMN id SET DEFAULT nextval('public.scrapped_devices_id_seq'::regclass);


--
-- TOC entry 5019 (class 2604 OID 33434)
-- Name: station_types station_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.station_types ALTER COLUMN station_type_id SET DEFAULT nextval('public.station_types_station_type_id_seq'::regclass);


--
-- TOC entry 5051 (class 2604 OID 33513)
-- Name: student_email_verification_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_email_verification_codes ALTER COLUMN id SET DEFAULT nextval('public.student_email_verification_codes_id_seq'::regclass);


--
-- TOC entry 5044 (class 2604 OID 33449)
-- Name: student_issue_requests request_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_issue_requests ALTER COLUMN request_id SET DEFAULT nextval('public.student_issue_requests_request_id_seq'::regclass);


--
-- TOC entry 5015 (class 2604 OID 33435)
-- Name: transfer_requests transfer_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_requests ALTER COLUMN transfer_id SET DEFAULT nextval('public.transfer_requests_transfer_id_seq'::regclass);


--
-- TOC entry 4982 (class 2604 OID 33436)
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- TOC entry 4974 (class 2604 OID 33437)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5332 (class 0 OID 24683)
-- Dependencies: 230
-- Data for Name: bills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bills (bill_id, invoice_number, vendor_name, gstin, bill_date, total_amount, tax_amount, created_at, stock_entry, path) FROM stdin;
8	TTS/22-23	Team One Tech Solutions LLP	27AAPFT1991G1ZO	2022-08-12	2679780	408780	2026-02-28 14:10:28.964402		\N
9	INV-4213	one tech	27ACBEAHBADZ	2026-03-08	330000	50000	2026-03-08 17:34:18.792264	SE-4213-1	\N
10	awdsinv	am One Tech Solutions LLP	27AAPFT1991G1ZO	2025-08-28	123	234	2026-03-15 17:02:26.544501	dr432	uploads/am_one_tech_solutions_llp_awdsinv_20260315170226_298ec27b.pdf
11	awd	awda	AWD	6222-12-12	2347	2345	2026-03-15 17:07:31.391418	wda	uploads/awda_awd_20260315170731_e116bde7.pdf
12	TTS/22-23/0499	Team One Tech Solutions LLP	27AAPFT1991G1Z	2022-08-01	2679780	408780	2026-03-16 17:46:52.980395		uploads/team_one_tech_solutions_llp_tts_22_23_0499_20260316174652_9c0539c6.pdf
13	TTS/22-23/04500	Team One Tech Solutions LLP	27AAPFT1991G1E	2022-08-02	2679780	408780	2026-04-29 02:26:30.242729	awdad1234	uploads/team_one_tech_solutions_llp_tts_22_23_04500_20260429022653_14d32ce5.pdf
\.


--
-- TOC entry 5356 (class 0 OID 33289)
-- Dependencies: 254
-- Data for Name: device_code_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.device_code_counters (id, lab_id, device_type, last_number, updated_at) FROM stdin;
129	309	Mouse	25	2026-03-15 05:17:28.198066
130	309	Monitor	28	2026-03-15 05:17:28.198066
131	309	Keyboard	25	2026-03-15 05:17:28.198066
132	309	AC	2	2026-03-15 05:17:28.198066
133	309	PC	26	2026-03-15 05:17:28.198066
134	309	Smart Board	1	2026-03-15 05:17:28.198066
141	309	linked_group_0	0	2026-03-15 05:17:28.198066
142	309	linked_group_1	0	2026-03-15 05:17:28.198066
143	309	linked_group_2	0	2026-03-15 05:17:28.198066
152	317	PC	6	2026-04-02 21:02:02.977777
153	317	Monitor	1	2026-04-02 21:02:02.977777
\.


--
-- TOC entry 5339 (class 0 OID 24802)
-- Dependencies: 237
-- Data for Name: device_issue_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.device_issue_history (history_id, issue_id, action, old_status, new_status, note, changed_at, bill_id, changed_by) FROM stdin;
16	11	created	\N	open	severity=medium	2026-03-21 16:23:38.861889	8	mayank salvi
17	12	created	\N	open	severity=medium	2026-03-21 16:23:56.238967	8	mayank salvi
18	11	status_updated	open	resolved	Status changed from open to resolved	2026-03-22 15:23:11.860364	8	mayank salvi
19	12	status_updated	open	resolved	Status changed from open to resolved	2026-03-22 15:23:17.009156	8	mayank salvi
20	13	created	\N	open	severity=high	2026-03-22 15:43:24.541161	8	mayank salvi
21	13	status_updated	open	resolved	Status changed from open to resolved	2026-03-22 15:58:50.734669	8	mayank salvi
22	14	created	\N	open	severity=critical	2026-03-22 15:59:51.088714	8	mayank salvi
23	15	created	\N	open	severity=high	2026-04-02 21:38:40.665776	9	mayank salvi
24	16	created	\N	open	severity=medium	2026-04-02 21:57:14.979548	9	mayank salvi
25	17	created	\N	open	severity=medium	2026-04-02 21:59:44.928648	9	mayank salvi
26	14	status_updated	open	resolved	Status changed from open to resolved	2026-04-02 22:01:18.291811	8	mayank salvi
27	15	status_updated	open	resolved	Status changed from open to resolved	2026-04-02 22:01:23.322176	9	mayank salvi
28	16	status_updated	open	in-progress	Status changed from open to in-progress	2026-04-02 22:01:30.759427	9	mayank salvi
29	17	status_updated	open	resolved	Status changed from open to resolved	2026-04-02 22:01:40.858282	9	mayank salvi
30	16	status_updated	in-progress	resolved	Status changed from in-progress to resolved	2026-04-07 14:06:16.374701	9	mayank salvi
31	18	created	\N	open	severity=medium	2026-04-07 14:06:33.836697	9	mayank salvi
32	19	created	\N	open	Approved student complaint request #1	2026-06-02 20:16:28.370606	9	salvi mayank
33	20	created	\N	open	Approved student complaint request #2	2026-06-02 21:14:27.592717	9	salvi mayank
\.


--
-- TOC entry 5337 (class 0 OID 24784)
-- Dependencies: 235
-- Data for Name: device_issues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.device_issues (issue_id, device_id, issue_title, description, status, reported_at, resolved_at, bill_id, severity, reported_by) FROM stdin;
11	503	Overheating issues	Device overheating	resolved	2026-03-21 16:23:38.861889	2026-03-22 15:23:11.860364	8	medium	mayank salvi
12	502	Slow performance	System running slow	resolved	2026-03-21 16:23:56.238967	2026-03-22 15:23:17.009156	8	medium	mayank salvi
13	502	OS not loading / blue screen	OS not loading / BSOD	resolved	2026-03-22 15:43:24.541161	2026-03-22 15:58:50.734669	8	high	mayank salvi
14	502	Not powering on / no boot	PC not powering on	resolved	2026-03-22 15:59:51.088714	2026-04-02 22:01:18.291811	8	critical	mayank salvi
15	693	Not detected / not working	Mouse not detected or working	resolved	2026-04-02 21:38:40.665776	2026-04-02 22:01:23.322176	9	high	mayank salvi
17	692	Buttons not responding	Mouse buttons not responding	resolved	2026-04-02 21:59:44.928648	2026-04-02 22:01:40.858282	9	medium	mayank salvi
16	643	Screen flickering	Screen flickering issue	resolved	2026-04-02 21:57:14.979548	2026-04-07 14:06:16.374701	9	medium	mayank salvi
18	642	Screen flickering	Screen flickering issue	open	2026-04-07 14:06:33.836697	\N	9	medium	mayank salvi
19	717	Not working	AC not working properly	open	2026-06-02 20:16:28.370606	\N	9	high	Student: mayank <mayanksalvi180@apsit.edu.in>
20	717	Not working	AC not working properly	open	2026-06-02 21:14:27.592717	\N	9	high	Student: mayank <mayanksalvi180@apsit.edu.in>
\.


--
-- TOC entry 5334 (class 0 OID 24694)
-- Dependencies: 232
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.devices (device_id, asset_code, type_id, brand, model, specification, unit_price, purchase_date, bill_id, lab_id, warranty_years, is_active, created_at, invoice_number, dept, qr_value, assigned_code, central_store_no, central_store_date, order_no, order_date, remarks) FROM stdin;
867	apsit/comp/19	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/19	\N	csr23456	2025-12-12	awdad234	2025-12-12	
532	/CO/31	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
696	IT/MO/55	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/5	 APSIT/309/MS/5	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
700	IT/MO/59	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/9	 APSIT/309/MS/9	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
707	IT/MO/66	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/16	 APSIT/309/MS/16	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
658	IT/MO/17	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/17	 APSIT/309/MON/17	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
708	IT/MO/67	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/17	 APSIT/309/MS/17	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
659	IT/MO/18	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/18	 APSIT/309/MON/18	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
661	IT/MO/20	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/20	 APSIT/309/MON/20	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
653	IT/MO/12	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/12	 APSIT/309/MON/12	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
678	IT/KE/37	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/12	 APSIT/309/KB/12	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
679	IT/KE/38	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/13	 APSIT/309/KB/13	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
680	IT/KE/39	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/14	 APSIT/309/KB/14	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
706	IT/MO/65	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/15	 APSIT/309/MS/15	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
682	IT/KE/41	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/16	 APSIT/309/KB/16	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
687	IT/KE/46	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/21	 APSIT/309/KB/21	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
662	IT/MO/21	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	\N	2	f	2026-03-08 17:34:29.226167	INV-4213	IT	\N	\N	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
528	/CO/27	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
529	/CO/28	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
530	/CO/29	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
531	/CO/30	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
548	/CO/47	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/47	\N	\N	\N	\N	\N	\N
870	apsit/comp/22	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/22	\N	csr23456	2025-12-12	awdad234	2025-12-12	
701	IT/MO/60	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/10	 APSIT/309/MS/10	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
549	/CO/48	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/48	\N	\N	\N	\N	\N	\N
550	/CO/49	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/49	\N	\N	\N	\N	\N	\N
551	/CO/50	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/50	\N	\N	\N	\N	\N	\N
552	/CO/51	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/51	\N	\N	\N	\N	\N	\N
553	/CO/52	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/52	\N	\N	\N	\N	\N	\N
555	/CO/54	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/54	\N	\N	\N	\N	\N	\N
556	/CO/55	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/55	\N	\N	\N	\N	\N	\N
554	/CO/53	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/53	\N	\N	\N	\N	\N	\N
557	/MO/56	12	Hp		Led Monitor HP 23.8"	14200	2022-08-12	8	309	2	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/MON/26	 APSIT/309/MON/26	\N	\N	\N	\N	\N
702	IT/MO/61	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/11	 APSIT/309/MS/11	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
558	/MO/57	12	Hp		Led Monitor HP 23.8"	14200	2022-08-12	8	309	2	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/MON/27	 APSIT/309/MON/27	\N	\N	\N	\N	\N
560	/MO/59	12	Hp		Led Monitor HP 23.8"	14200	2022-08-12	8	317	2	t	2026-02-28 14:10:29.027313	TTS/22-23		APSIT/317/MON/1	APSIT/317/MON/1	\N	\N	\N	\N	\N
703	IT/MO/62	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/12	 APSIT/309/MS/12	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
514	/CO/13	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/13	 APSIT/309/PC/13	\N	\N	\N	\N	\N
654	IT/MO/13	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/13	 APSIT/309/MON/13	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
712	IT/MO/71	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/21	 APSIT/309/MS/21	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
648	IT/MO/7	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/7	 APSIT/309/MON/7	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
649	IT/MO/8	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/8	 APSIT/309/MON/8	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
674	IT/KE/33	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/8	 APSIT/309/KB/8	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
675	IT/KE/34	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/9	 APSIT/309/KB/9	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
651	IT/MO/10	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/10	 APSIT/309/MON/10	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
676	IT/KE/35	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/10	 APSIT/309/KB/10	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
561	/MO/60	12	Hp		Led Monitor HP 23.8"	14200	2022-08-12	8	\N	2	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
533	/CO/32	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
534	/CO/33	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
535	/CO/34	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
536	/CO/35	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
537	/CO/36	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
538	/CO/37	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
539	/CO/38	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
849	apsit/comp/1	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/1	\N	csr23456	2025-12-12	awdad234	2025-12-12	
880	apsit/comp/32	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/32	\N	csr23456	2025-12-12	awdad234	2025-12-12	
512	/CO/11	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/11	 APSIT/309/PC/11	\N	\N	\N	\N	\N
547	/CO/46	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		TTS/22-23|Team One Tech Solutions LLP|/CO/46	\N	\N	\N	\N	\N	\N
513	/CO/12	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/12	 APSIT/309/PC/12	\N	\N	\N	\N	\N
704	IT/MO/63	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/13	 APSIT/309/MS/13	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
515	/CO/14	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/14	 APSIT/309/PC/14	\N	\N	\N	\N	\N
655	IT/MO/14	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/14	 APSIT/309/MON/14	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
544	/CO/43	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
546	/CO/45	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
705	IT/MO/64	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/14	 APSIT/309/MS/14	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
516	/CO/15	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/15	 APSIT/309/PC/15	\N	\N	\N	\N	\N
656	IT/MO/15	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/15	 APSIT/309/MON/15	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
517	/CO/16	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/16	 APSIT/309/PC/16	\N	\N	\N	\N	\N
518	/CO/17	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/17	 APSIT/309/PC/17	\N	\N	\N	\N	\N
683	IT/KE/42	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/17	 APSIT/309/KB/17	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
559	/MO/58	12	Hp		Led Monitor HP 23.8"	14200	2022-08-12	8	\N	2	f	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/MON/28	 APSIT/309/MON/28	\N	\N	\N	\N	\N
527	/CO/26	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/26	 APSIT/309/PC/26	\N	\N	\N	\N	\N
691	IT/KE/50	13	Logitech		Logitech keyboard	500	2026-03-08	9	\N	2	f	2026-03-08 17:34:29.226167	INV-4213	IT	\N	\N	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
642	IT/MO/1	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/1	 APSIT/309/MON/1	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
684	IT/KE/43	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/18	 APSIT/309/KB/18	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
663	IT/MO/22	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/22	 APSIT/309/MON/22	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
688	IT/KE/47	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/22	 APSIT/309/KB/22	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
716	IT/MO/75	14	Logitech		Logitech mouse	300	2026-03-08	9	\N	1	f	2026-03-08 17:34:29.226167	INV-4213	IT	\N	\N	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
689	IT/KE/48	13	Logitech		Logitech keyboard	500	2026-03-08	9	\N	2	f	2026-03-08 17:34:29.226167	INV-4213	IT	\N	\N	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
693	IT/MO/52	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/2	 APSIT/309/MS/2	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
643	IT/MO/2	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/2	 APSIT/309/MON/2	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
713	IT/MO/72	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/22	 APSIT/309/MS/22	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
690	IT/KE/49	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/24	 APSIT/309/KB/24	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
540	/CO/39	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
541	/CO/40	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
542	/CO/41	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
543	/CO/42	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
545	/CO/44	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	\N	3	f	2026-02-28 14:10:29.027313	TTS/22-23		\N	\N	\N	\N	\N	\N	\N
722	 309/ST-1/1	17	HP	awda	Computer System Branded-HP	100	2025-08-28	10	\N	2	f	2026-03-15 17:02:26.609231	awdsinv	IT	awdsinv|am One Tech Solutions LLP| 309/ST-1/1	\N	fszdfdx	56-34-12	awdsdw	56-34-12	awd
723	 309/ST-1/2	17	HP	awda	Computer System Branded-HP	100	2025-08-28	10	\N	2	f	2026-03-15 17:02:26.609231	awdsinv	IT	awdsinv|am One Tech Solutions LLP| 309/ST-1/2	\N	fszdfdx	56-34-12	awdsdw	56-34-12	awd
724	 309/ST-1/3	17	HP	awda	Computer System Branded-HP	100	2025-08-28	10	\N	2	f	2026-03-15 17:02:26.609231	awdsinv	IT	awdsinv|am One Tech Solutions LLP| 309/ST-1/3	\N	fszdfdx	56-34-12	awdsdw	56-34-12	awd
725	 309/ST-1/4	17	HP	awda	Computer System Branded-HP	100	2025-08-28	10	\N	2	f	2026-03-15 17:02:26.609231	awdsinv	IT	awdsinv|am One Tech Solutions LLP| 309/ST-1/4	\N	fszdfdx	56-34-12	awdsdw	56-34-12	awd
726	 309/ST-1/5	17	HP	awda	Computer System Branded-HP	100	2025-08-28	10	\N	2	f	2026-03-15 17:02:26.609231	awdsinv	IT	awdsinv|am One Tech Solutions LLP| 309/ST-1/5	\N	fszdfdx	56-34-12	awdsdw	56-34-12	awd
727	 309/ST-1/6	17	HP	awda	Computer System Branded-HP	100	2025-08-28	10	\N	2	f	2026-03-15 17:02:26.609231	awdsinv	IT	awdsinv|am One Tech Solutions LLP| 309/ST-1/6	\N	fszdfdx	56-34-12	awdsdw	56-34-12	awd
729	/CO/1	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/1	\N		\N		\N	
730	/CO/2	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/2	\N		\N		\N	
731	/CO/3	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/3	\N		\N		\N	
732	/CO/4	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/4	\N		\N		\N	
733	/CO/5	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/5	\N		\N		\N	
734	/CO/6	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/6	\N		\N		\N	
735	/CO/7	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/7	\N		\N		\N	
644	IT/MO/3	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/3	 APSIT/309/MON/3	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
505	/CO/4	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/4	 APSIT/309/PC/4	\N	\N	\N	\N	\N
645	IT/MO/4	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/4	 APSIT/309/MON/4	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
670	IT/KE/29	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/4	 APSIT/309/KB/4	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
506	/CO/5	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/5	 APSIT/309/PC/5	\N	\N	\N	\N	\N
646	IT/MO/5	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/5	 APSIT/309/MON/5	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
671	IT/KE/30	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/5	 APSIT/309/KB/5	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
507	/CO/6	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/6	 APSIT/309/PC/6	\N	\N	\N	\N	\N
647	IT/MO/6	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/6	 APSIT/309/MON/6	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
509	/CO/8	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/8	 APSIT/309/PC/8	\N	\N	\N	\N	\N
681	IT/KE/40	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/15	 APSIT/309/KB/15	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
657	IT/MO/16	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/16	 APSIT/309/MON/16	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
736	/CO/8	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/8	\N		\N		\N	
737	/CO/9	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/9	\N		\N		\N	
738	/CO/10	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/10	\N		\N		\N	
739	/CO/11	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/11	\N		\N		\N	
740	/CO/12	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/12	\N		\N		\N	
741	/CO/13	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/13	\N		\N		\N	
742	/CO/14	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/14	\N		\N		\N	
743	/CO/15	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/15	\N		\N		\N	
744	/CO/16	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/16	\N		\N		\N	
745	/CO/17	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/17	\N		\N		\N	
746	/CO/18	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/18	\N		\N		\N	
747	/CO/19	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/19	\N		\N		\N	
748	/CO/20	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/20	\N		\N		\N	
749	/CO/21	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/21	\N		\N		\N	
750	/CO/22	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/22	\N		\N		\N	
728	adw/1	3	awd	awd	awd	2	6222-12-12	11	\N	2	f	2026-03-15 17:07:31.447371	awd	IT	awd|awda|adw/1	\N	wdad	6222-12-12	awd	2222-12-12	awd
751	/CO/23	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/23	\N		\N		\N	
752	/CO/24	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/24	\N		\N		\N	
753	/CO/25	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/25	\N		\N		\N	
754	/CO/26	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/26	\N		\N		\N	
755	/CO/27	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/27	\N		\N		\N	
756	/CO/28	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/28	\N		\N		\N	
757	/CO/29	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/29	\N		\N		\N	
758	/CO/30	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/30	\N		\N		\N	
759	/CO/31	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/31	\N		\N		\N	
760	/CO/32	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/32	\N		\N		\N	
761	/CO/33	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/33	\N		\N		\N	
762	/CO/34	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/34	\N		\N		\N	
763	/CO/35	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/35	\N		\N		\N	
764	/CO/36	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/36	\N		\N		\N	
765	/CO/37	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/37	\N		\N		\N	
766	/CO/38	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/38	\N		\N		\N	
719	IT/AC/78	3	Blue Star		Blue Star AC	20000	2026-03-08	9	\N	5	f	2026-03-08 17:34:29.226167	INV-4213	IT	INV-4213|one tech|IT/AC/78	\N	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
720	IT/AC/79	3	Blue Star		Blue Star AC	20000	2026-03-08	9	\N	5	f	2026-03-08 17:34:29.226167	INV-4213	IT	INV-4213|one tech|IT/AC/79	\N	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
504	/CO/3	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/3	 APSIT/309/PC/3	\N	\N	\N	\N	\N
669	IT/KE/28	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/3	 APSIT/309/KB/3	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
767	/CO/39	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/39	\N		\N		\N	
768	/CO/40	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/40	\N		\N		\N	
769	/CO/41	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/41	\N		\N		\N	
770	/CO/42	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/42	\N		\N		\N	
771	/CO/43	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/43	\N		\N		\N	
772	/CO/44	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/44	\N		\N		\N	
773	/CO/45	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/45	\N		\N		\N	
694	IT/MO/53	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/3	 APSIT/309/MS/3	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
695	IT/MO/54	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/4	 APSIT/309/MS/4	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
672	IT/KE/31	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/6	 APSIT/309/KB/6	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
697	IT/MO/56	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/6	 APSIT/309/MS/6	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
508	/CO/7	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/7	 APSIT/309/PC/7	\N	\N	\N	\N	\N
673	IT/KE/32	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/7	 APSIT/309/KB/7	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
698	IT/MO/57	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/7	 APSIT/309/MS/7	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
699	IT/MO/58	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/8	 APSIT/309/MS/8	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
510	/CO/9	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/9	 APSIT/309/PC/9	\N	\N	\N	\N	\N
652	IT/MO/11	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/11	 APSIT/309/MON/11	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
677	IT/KE/36	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/11	 APSIT/309/KB/11	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
519	/CO/18	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/18	 APSIT/309/PC/18	\N	\N	\N	\N	\N
774	/CO/46	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/46	\N		\N		\N	
775	/CO/47	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/47	\N		\N		\N	
776	/CO/48	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/48	\N		\N		\N	
777	/CO/49	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/49	\N		\N		\N	
778	/CO/50	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/50	\N		\N		\N	
779	/CO/51	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/51	\N		\N		\N	
780	/CO/52	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/52	\N		\N		\N	
781	/CO/53	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/53	\N		\N		\N	
721	IT/SM/80	4	Samsung		Samsung smart board	30000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/SB/1	 APSIT/309/SB/1	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
718	IT/AC/77	3	Blue Star		Blue Star AC	20000	2026-03-08	9	309	5	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/AC/2	 APSIT/309/AC/2	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
667	IT/KE/26	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/1	 APSIT/309/KB/1	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
717	IT/AC/76	3	Blue Star		Blue Star AC	20000	2026-03-08	9	309	5	f	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/AC/1	 APSIT/309/AC/1	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
668	IT/KE/27	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/2	 APSIT/309/KB/2	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
782	/CO/54	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/54	\N		\N		\N	
783	/CO/55	17	HP		Computer System Branded-HP	40000	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/CO/55	\N		\N		\N	
784	/MO/56	12	HP	23.8	Led Monitor HP 23.8"	14200	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/MO/56	\N		\N		\N	
785	/MO/57	12	HP	23.8	Led Monitor HP 23.8"	14200	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/MO/57	\N		\N		\N	
786	/MO/58	12	HP	23.8	Led Monitor HP 23.8"	14200	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/MO/58	\N		\N		\N	
787	/MO/59	12	HP	23.8	Led Monitor HP 23.8"	14200	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/MO/59	\N		\N		\N	
788	/MO/60	12	HP	23.8	Led Monitor HP 23.8"	14200	2022-08-01	12	\N	0	f	2026-03-16 17:46:53.044202	TTS/22-23/0499		TTS/22-23/0499|Team One Tech Solutions LLP|/MO/60	\N		\N		\N	
503	/CO/2	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/2	 APSIT/309/PC/2	\N	\N	\N	\N	\N
502	/CO/1	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/1	 APSIT/309/PC/1	\N	\N	\N	\N	\N
692	IT/MO/51	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/1	 APSIT/309/MS/1	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
715	IT/MO/74	14	Logitech		Logitech mouse	300	2026-03-08	9	\N	1	f	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/24	 APSIT/309/MS/24	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
526	/CO/25	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	317	3	t	2026-02-28 14:10:29.027313	TTS/22-23		APSIT/317/PC/6	APSIT/317/PC/6	\N	\N	\N	\N	\N
666	IT/MO/25	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	\N	2	f	2026-03-08 17:34:29.226167	INV-4213	IT	\N	\N	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
665	IT/MO/24	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	\N	2	f	2026-03-08 17:34:29.226167	INV-4213	IT	\N	\N	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
650	IT/MO/9	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/9	 APSIT/309/MON/9	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
511	/CO/10	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/10	 APSIT/309/PC/10	\N	\N	\N	\N	\N
524	/CO/23	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/23	 APSIT/309/PC/23	\N	\N	\N	\N	\N
664	IT/MO/23	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/23	 APSIT/309/MON/23	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
714	IT/MO/73	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/23	 APSIT/309/MS/23	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
525	/CO/24	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/24	 APSIT/309/PC/24	\N	\N	\N	\N	\N
852	apsit/comp/4	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/4	\N	csr23456	2025-12-12	awdad234	2025-12-12	
851	apsit/comp/3	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/3	\N	csr23456	2025-12-12	awdad234	2025-12-12	
850	apsit/comp/2	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/2	\N	csr23456	2025-12-12	awdad234	2025-12-12	
853	apsit/comp/5	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/5	\N	csr23456	2025-12-12	awdad234	2025-12-12	
854	apsit/comp/6	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/6	\N	csr23456	2025-12-12	awdad234	2025-12-12	
855	apsit/comp/7	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/7	\N	csr23456	2025-12-12	awdad234	2025-12-12	
856	apsit/comp/8	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/8	\N	csr23456	2025-12-12	awdad234	2025-12-12	
859	apsit/comp/11	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/11	\N	csr23456	2025-12-12	awdad234	2025-12-12	
709	IT/MO/68	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/18	 APSIT/309/MS/18	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
520	/CO/19	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/19	 APSIT/309/PC/19	\N	\N	\N	\N	\N
660	IT/MO/19	12	HP	abc-123	Led Monitor HP 23.8"	6000	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MON/19	 APSIT/309/MON/19	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
685	IT/KE/44	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/19	 APSIT/309/KB/19	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
710	IT/MO/69	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/19	 APSIT/309/MS/19	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
521	/CO/20	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/20	 APSIT/309/PC/20	\N	\N	\N	\N	\N
686	IT/KE/45	13	Logitech		Logitech keyboard	500	2026-03-08	9	309	2	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/KB/20	 APSIT/309/KB/20	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
711	IT/MO/70	14	Logitech		Logitech mouse	300	2026-03-08	9	309	1	t	2026-03-08 17:34:29.226167	INV-4213	IT	 APSIT/309/MS/20	 APSIT/309/MS/20	CSI-1332	2026-03-10	ORD-1243	2026-03-08	nothing
522	/CO/21	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/21	 APSIT/309/PC/21	\N	\N	\N	\N	\N
523	/CO/22	2	Hp		Computer System Branded-HP	40000	2022-08-12	8	309	3	t	2026-02-28 14:10:29.027313	TTS/22-23		 APSIT/309/PC/22	 APSIT/309/PC/22	\N	\N	\N	\N	\N
858	apsit/comp/10	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/10	\N	csr23456	2025-12-12	awdad234	2025-12-12	
860	apsit/comp/12	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/12	\N	csr23456	2025-12-12	awdad234	2025-12-12	
857	apsit/comp/9	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/9	\N	csr23456	2025-12-12	awdad234	2025-12-12	
861	apsit/comp/13	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/13	\N	csr23456	2025-12-12	awdad234	2025-12-12	
862	apsit/comp/14	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/14	\N	csr23456	2025-12-12	awdad234	2025-12-12	
863	apsit/comp/15	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/15	\N	csr23456	2025-12-12	awdad234	2025-12-12	
864	apsit/comp/16	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/16	\N	csr23456	2025-12-12	awdad234	2025-12-12	
865	apsit/comp/17	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/17	\N	csr23456	2025-12-12	awdad234	2025-12-12	
866	apsit/comp/18	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/18	\N	csr23456	2025-12-12	awdad234	2025-12-12	
868	apsit/comp/20	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/20	\N	csr23456	2025-12-12	awdad234	2025-12-12	
869	apsit/comp/21	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/21	\N	csr23456	2025-12-12	awdad234	2025-12-12	
871	apsit/comp/23	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/23	\N	csr23456	2025-12-12	awdad234	2025-12-12	
872	apsit/comp/24	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/24	\N	csr23456	2025-12-12	awdad234	2025-12-12	
873	apsit/comp/25	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/25	\N	csr23456	2025-12-12	awdad234	2025-12-12	
874	apsit/comp/26	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/26	\N	csr23456	2025-12-12	awdad234	2025-12-12	
875	apsit/comp/27	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/27	\N	csr23456	2025-12-12	awdad234	2025-12-12	
876	apsit/comp/28	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/28	\N	csr23456	2025-12-12	awdad234	2025-12-12	
877	apsit/comp/29	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/29	\N	csr23456	2025-12-12	awdad234	2025-12-12	
878	apsit/comp/30	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/30	\N	csr23456	2025-12-12	awdad234	2025-12-12	
879	apsit/comp/31	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/31	\N	csr23456	2025-12-12	awdad234	2025-12-12	
881	apsit/comp/33	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/33	\N	csr23456	2025-12-12	awdad234	2025-12-12	
883	apsit/comp/35	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/35	\N	csr23456	2025-12-12	awdad234	2025-12-12	
882	apsit/comp/34	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/34	\N	csr23456	2025-12-12	awdad234	2025-12-12	
884	apsit/comp/36	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/36	\N	csr23456	2025-12-12	awdad234	2025-12-12	
885	apsit/comp/37	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/37	\N	csr23456	2025-12-12	awdad234	2025-12-12	
886	apsit/comp/38	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/38	\N	csr23456	2025-12-12	awdad234	2025-12-12	
887	apsit/comp/39	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/39	\N	csr23456	2025-12-12	awdad234	2025-12-12	
888	apsit/comp/40	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/40	\N	csr23456	2025-12-12	awdad234	2025-12-12	
889	apsit/comp/41	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/41	\N	csr23456	2025-12-12	awdad234	2025-12-12	
891	apsit/comp/43	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/43	\N	csr23456	2025-12-12	awdad234	2025-12-12	
890	apsit/comp/42	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/42	\N	csr23456	2025-12-12	awdad234	2025-12-12	
892	apsit/comp/44	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/44	\N	csr23456	2025-12-12	awdad234	2025-12-12	
893	apsit/comp/45	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/45	\N	csr23456	2025-12-12	awdad234	2025-12-12	
894	apsit/comp/46	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/46	\N	csr23456	2025-12-12	awdad234	2025-12-12	
895	apsit/comp/47	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/47	\N	csr23456	2025-12-12	awdad234	2025-12-12	
896	apsit/comp/48	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/48	\N	csr23456	2025-12-12	awdad234	2025-12-12	
897	apsit/comp/49	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/49	\N	csr23456	2025-12-12	awdad234	2025-12-12	
898	apsit/comp/50	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/50	\N	csr23456	2025-12-12	awdad234	2025-12-12	
899	apsit/comp/51	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/51	\N	csr23456	2025-12-12	awdad234	2025-12-12	
904	apsit/mon/1	12	LENOVO	23.8	Led Monitor HP 23.8"	14200	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/mon/1	\N	csr23456	2025-12-12	awdad234	2025-12-12	
905	apsit/mon/2	12	LENOVO	23.8	Led Monitor HP 23.8"	14200	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/mon/2	\N	csr23456	2025-12-12	awdad234	2025-12-12	
906	apsit/mon/3	12	LENOVO	23.8	Led Monitor HP 23.8"	14200	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/mon/3	\N	csr23456	2025-12-12	awdad234	2025-12-12	
907	apsit/mon/4	12	LENOVO	23.8	Led Monitor HP 23.8"	14200	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/mon/4	\N	csr23456	2025-12-12	awdad234	2025-12-12	
908	apsit/mon/5	12	LENOVO	23.8	Led Monitor HP 23.8"	14200	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/mon/5	\N	csr23456	2025-12-12	awdad234	2025-12-12	
900	apsit/comp/52	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/52	\N	csr23456	2025-12-12	awdad234	2025-12-12	
902	apsit/comp/54	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/54	\N	csr23456	2025-12-12	awdad234	2025-12-12	
901	apsit/comp/53	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/53	\N	csr23456	2025-12-12	awdad234	2025-12-12	
903	apsit/comp/55	2	LENOVO		Computer System Branded-HP	40000	2022-08-02	13	\N	3	f	2026-04-29 02:26:54.998657	TTS/22-23/04500	IT	TTS/22-23/04500|Team One Tech Solutions LLP|apsit/comp/55	\N	csr23456	2025-12-12	awdad234	2025-12-12	
\.


--
-- TOC entry 5365 (class 0 OID 33492)
-- Dependencies: 263
-- Data for Name: email_verification_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_verification_codes (id, email, code_hash, created_at, expires_at, used_at, attempts) FROM stdin;
1	mayanksalvi180@apsit.edu.in	$2b$12$K4NoJRGhjIZztbp8HNyj2uLBz.bUME2EVRCzs8766E67PcYBcyqyC	2026-06-02 20:05:26.612153	2026-06-02 14:45:26.84371	2026-06-02 14:35:55.382177	0
\.


--
-- TOC entry 5330 (class 0 OID 24624)
-- Dependencies: 228
-- Data for Name: equipment_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.equipment_types (type_id, name) FROM stdin;
1	Laptop
2	PC
3	AC
4	Smart Board
5	Projector
6	Printer
7	Scanner
8	UPS
9	Router
10	Switch
11	Server
12	Monitor
13	Keyboard
14	Mouse
15	Webcam
16	Headset
17	Other
\.


--
-- TOC entry 5346 (class 0 OID 24912)
-- Dependencies: 244
-- Data for Name: lab_equipment_pool; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_equipment_pool (id, lab_id, equipment_type, brand, model, specification, quantity_added, quantity_assigned, invoice_number, bill_id, unit_price, purchase_date, is_standby, linked_group_id, created_at) FROM stdin;
216	309	PC	HP		Computer System Branded-HP	15	0	TTS/22-23/0499	12	\N	\N	f	\N	2026-03-16 20:28:49.827145
204	317	Monitor	Hp		Led Monitor HP 23.8"	1	1	TTS/22-23	8	\N	\N	f	\N	2026-04-02 21:02:02.977777
205	317	PC	Hp		Computer System Branded-HP	1	1	TTS/22-23	8	\N	\N	f	\N	2026-04-02 21:02:02.977777
187	309	PC	Hp		Computer System Branded-HP	25	0	TTS/22-23	8	\N	\N	f	\N	2026-03-15 05:18:07.24491
188	309	Smart Board	Samsung		Samsung smart board	1	0	INV-4213	9	\N	\N	f	\N	2026-03-15 05:18:07.24491
189	309	Mouse	Logitech		Logitech mouse	24	0	INV-4213	9	\N	\N	f	\N	2026-03-15 05:18:07.24491
190	309	Keyboard	Logitech		Logitech keyboard	23	0	INV-4213	9	\N	\N	f	\N	2026-03-15 05:18:07.24491
191	309	AC	Blue Star		Blue Star AC	2	0	INV-4213	9	\N	\N	f	\N	2026-03-15 05:18:07.24491
192	309	Monitor	Hp		Led Monitor HP 23.8"	3	0	TTS/22-23	8	\N	\N	f	\N	2026-03-15 05:18:07.24491
193	309	Monitor	HP	abc-123	Led Monitor HP 23.8"	22	0	INV-4213	9	\N	\N	f	\N	2026-03-15 05:18:07.24491
\.


--
-- TOC entry 5335 (class 0 OID 24725)
-- Dependencies: 233
-- Data for Name: lab_grid_cells; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_grid_cells (cell_id, lab_id, row_number, column_number, assigned_code, equipment_type, os_windows, os_linux, os_other, is_empty, station_id, created_at) FROM stdin;
2378	309	0	2	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2380	309	0	4	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2384	309	1	0	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2391	309	1	7	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2392	309	2	0	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2399	309	2	7	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2408	309	4	0	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2415	309	4	7	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2416	309	5	0	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2417	309	5	1	309/ST-33	PC	t	t	f	f	1074	2026-03-15 05:13:10.05768
2423	309	5	7	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2424	309	6	0	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2425	309	6	1	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2426	309	6	2	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2427	309	6	3	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2428	309	6	4	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2530	317	0	0	317/ST-1	CCTV	f	f	f	t	1147	2026-04-02 21:02:02.977777
2376	309	0	0	309/ST-1	CCTV	f	f	f	t	1042	2026-03-15 05:13:10.05768
2377	309	0	1	309/ST-2	AC	f	f	f	f	1043	2026-03-15 05:13:10.05768
2379	309	0	3	309/ST-3	Smart Board	f	f	f	f	1044	2026-03-15 05:13:10.05768
2381	309	0	5	309/ST-4	Printer	f	f	f	t	1045	2026-03-15 05:13:10.05768
2382	309	0	6	309/ST-5	AC	f	f	f	f	1046	2026-03-15 05:13:10.05768
2383	309	0	7	309/ST-6	CCTV	f	f	f	t	1047	2026-03-15 05:13:10.05768
2385	309	1	1	309/ST-7	PC	t	t	f	f	1048	2026-03-15 05:13:10.05768
2386	309	1	2	309/ST-8	PC	t	t	f	f	1049	2026-03-15 05:13:10.05768
2387	309	1	3	309/ST-9	Passage	f	f	f	t	1050	2026-03-15 05:13:10.05768
2388	309	1	4	309/ST-10	PC	t	t	f	f	1051	2026-03-15 05:13:10.05768
2389	309	1	5	309/ST-11	PC	t	t	f	f	1052	2026-03-15 05:13:10.05768
2390	309	1	6	309/ST-12	PC	t	t	f	f	1053	2026-03-15 05:13:10.05768
2393	309	2	1	309/ST-13	PC	t	t	f	f	1054	2026-03-15 05:13:10.05768
2394	309	2	2	309/ST-14	PC	t	t	f	f	1055	2026-03-15 05:13:10.05768
2395	309	2	3	309/ST-15	Passage	f	f	f	t	1056	2026-03-15 05:13:10.05768
2396	309	2	4	309/ST-16	PC	t	t	f	f	1057	2026-03-15 05:13:10.05768
2397	309	2	5	309/ST-17	PC	t	t	f	f	1058	2026-03-15 05:13:10.05768
2398	309	2	6	309/ST-18	PC	t	t	f	f	1059	2026-03-15 05:13:10.05768
2400	309	3	0	309/ST-19	Router	f	f	f	t	1060	2026-03-15 05:13:10.05768
2401	309	3	1	309/ST-20	PC	t	t	f	f	1061	2026-03-15 05:13:10.05768
2402	309	3	2	309/ST-21	PC	t	t	f	f	1062	2026-03-15 05:13:10.05768
2403	309	3	3	309/ST-22	Passage	f	f	f	t	1063	2026-03-15 05:13:10.05768
2404	309	3	4	309/ST-23	PC	t	t	f	f	1064	2026-03-15 05:13:10.05768
2405	309	3	5	309/ST-24	PC	t	t	f	f	1065	2026-03-15 05:13:10.05768
2406	309	3	6	309/ST-25	PC	t	t	f	f	1066	2026-03-15 05:13:10.05768
2407	309	3	7	309/ST-26	Router	f	f	f	t	1067	2026-03-15 05:13:10.05768
2409	309	4	1	309/ST-27	PC	t	t	f	f	1068	2026-03-15 05:13:10.05768
2410	309	4	2	309/ST-28	PC	t	t	f	f	1069	2026-03-15 05:13:10.05768
2411	309	4	3	309/ST-29	Passage	f	f	f	t	1070	2026-03-15 05:13:10.05768
2412	309	4	4	309/ST-30	PC	t	t	f	f	1071	2026-03-15 05:13:10.05768
2413	309	4	5	309/ST-31	PC	t	t	f	f	1072	2026-03-15 05:13:10.05768
2414	309	4	6	309/ST-32	PC	t	t	f	f	1073	2026-03-15 05:13:10.05768
2418	309	5	2	309/ST-34	PC	t	t	f	f	1075	2026-03-15 05:13:10.05768
2419	309	5	3	309/ST-35	Passage	f	f	f	t	1076	2026-03-15 05:13:10.05768
2420	309	5	4	309/ST-36	PC	t	t	f	f	1077	2026-03-15 05:13:10.05768
2421	309	5	5	309/ST-37	PC	t	t	f	f	1078	2026-03-15 05:13:10.05768
2422	309	5	6	\N	PC	t	t	f	f	1079	2026-03-15 05:13:10.05768
2531	317	0	1	317/ST-2	Door	f	f	f	t	1148	2026-04-02 21:02:02.977777
2532	317	0	2	317/ST-3	Smart Board	f	f	f	t	1149	2026-04-02 21:02:02.977777
2533	317	0	3	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2534	317	0	4	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2535	317	0	5	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2430	309	6	6	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2431	309	6	7	\N	Empty	f	f	f	t	\N	2026-03-15 05:13:10.05768
2536	317	0	6	317/ST-4	CCTV	f	f	f	t	1150	2026-04-02 21:02:02.977777
2537	317	1	0	317/ST-5	AC	f	f	f	t	1151	2026-04-02 21:02:02.977777
2429	309	6	5	309/ST-39	Door	f	f	f	t	1080	2026-03-15 05:13:10.05768
2538	317	1	1	317/ST-6	Passage	f	f	f	t	1152	2026-04-02 21:02:02.977777
2539	317	1	2	317/ST-7	PC	t	t	t	f	1153	2026-04-02 21:02:02.977777
2540	317	1	3	317/ST-8	PC	t	t	t	t	1154	2026-04-02 21:02:02.977777
2541	317	1	4	317/ST-9	PC	t	t	t	t	1155	2026-04-02 21:02:02.977777
2542	317	1	5	317/ST-10	PC	t	t	t	t	1156	2026-04-02 21:02:02.977777
2543	317	1	6	317/ST-11	AC	f	f	f	t	1157	2026-04-02 21:02:02.977777
2544	317	2	0	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2545	317	2	1	317/ST-12	Passage	f	f	f	t	1158	2026-04-02 21:02:02.977777
2546	317	2	2	317/ST-13	PC	t	t	t	t	1159	2026-04-02 21:02:02.977777
2547	317	2	3	317/ST-14	PC	t	t	t	t	1160	2026-04-02 21:02:02.977777
2548	317	2	4	317/ST-15	PC	t	t	t	t	1161	2026-04-02 21:02:02.977777
2549	317	2	5	317/ST-16	PC	t	t	t	t	1162	2026-04-02 21:02:02.977777
2550	317	2	6	317/ST-17	Router	f	f	f	t	1163	2026-04-02 21:02:02.977777
2551	317	3	0	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2552	317	3	1	317/ST-18	Passage	f	f	f	t	1164	2026-04-02 21:02:02.977777
2553	317	3	2	317/ST-19	PC	t	t	t	t	1165	2026-04-02 21:02:02.977777
2554	317	3	3	317/ST-20	PC	t	t	t	t	1166	2026-04-02 21:02:02.977777
2555	317	3	4	317/ST-21	PC	t	t	t	t	1167	2026-04-02 21:02:02.977777
2556	317	3	5	317/ST-22	PC	t	t	t	t	1168	2026-04-02 21:02:02.977777
2557	317	3	6	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2558	317	4	0	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2559	317	4	1	317/ST-23	Passage	f	f	f	t	1169	2026-04-02 21:02:02.977777
2560	317	4	2	317/ST-24	PC	t	t	t	t	1170	2026-04-02 21:02:02.977777
2561	317	4	3	317/ST-25	PC	t	t	t	t	1171	2026-04-02 21:02:02.977777
2562	317	4	4	317/ST-26	PC	t	t	t	t	1172	2026-04-02 21:02:02.977777
2563	317	4	5	317/ST-27	PC	t	t	t	t	1173	2026-04-02 21:02:02.977777
2564	317	4	6	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2565	317	5	0	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2566	317	5	1	317/ST-28	Passage	f	f	f	t	1174	2026-04-02 21:02:02.977777
2567	317	5	2	317/ST-29	PC	t	t	t	t	1175	2026-04-02 21:02:02.977777
2568	317	5	3	317/ST-30	PC	t	t	t	t	1176	2026-04-02 21:02:02.977777
2569	317	5	4	317/ST-31	PC	t	t	t	t	1177	2026-04-02 21:02:02.977777
2570	317	5	5	317/ST-32	PC	t	t	t	t	1178	2026-04-02 21:02:02.977777
2571	317	5	6	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2572	317	6	0	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2573	317	6	1	317/ST-33	Passage	f	f	f	t	1179	2026-04-02 21:02:02.977777
2574	317	6	2	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2575	317	6	3	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2576	317	6	4	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2577	317	6	5	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
2578	317	6	6	\N	Empty	f	f	f	t	\N	2026-04-02 21:02:02.977777
\.


--
-- TOC entry 5354 (class 0 OID 33105)
-- Dependencies: 252
-- Data for Name: lab_layout_cells; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_layout_cells (cell_id, layout_id, row_number, column_number, station_type_id, label, is_empty, os_windows, os_linux, os_other, notes, created_at) FROM stdin;
393	2	0	0	13	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
394	2	0	1	11	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
395	2	0	2	12	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
396	2	0	3	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
397	2	0	4	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
398	2	0	5	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
399	2	0	6	13	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
400	2	1	0	4	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
401	2	1	1	9	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
402	2	1	2	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
403	2	1	3	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
404	2	1	4	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
405	2	1	5	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
406	2	1	6	4	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
407	2	2	0	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
408	2	2	1	9	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
409	2	2	2	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
410	2	2	3	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
411	2	2	4	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
412	2	2	5	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
413	2	2	6	5	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
414	2	3	0	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
415	2	3	1	9	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
416	2	3	2	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
417	2	3	3	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
418	2	3	4	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
419	2	3	5	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
420	2	3	6	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
421	2	4	0	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
422	2	4	1	9	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
423	2	4	2	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
424	2	4	3	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
425	2	4	4	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
426	2	4	5	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
427	2	4	6	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
428	2	5	0	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
429	2	5	1	9	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
430	2	5	2	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
431	2	5	3	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
432	2	5	4	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
433	2	5	5	1	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
434	2	5	6	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
435	2	6	0	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
436	2	6	1	9	\N	f	f	f	f	\N	2026-03-12 13:36:56.50602
437	2	6	2	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
438	2	6	3	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
439	2	6	4	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
440	2	6	5	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
441	2	6	6	\N	\N	t	f	f	f	\N	2026-03-12 13:36:56.50602
337	1	0	0	13	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
338	1	0	1	4	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
339	1	0	2	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
340	1	0	3	12	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
341	1	0	4	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
342	1	0	5	7	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
343	1	0	6	4	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
344	1	0	7	13	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
345	1	1	0	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
346	1	1	1	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
347	1	1	2	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
348	1	1	3	9	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
349	1	1	4	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
350	1	1	5	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
351	1	1	6	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
352	1	1	7	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
353	1	2	0	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
354	1	2	1	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
355	1	2	2	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
356	1	2	3	9	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
357	1	2	4	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
358	1	2	5	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
359	1	2	6	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
360	1	2	7	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
361	1	3	0	5	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
362	1	3	1	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
363	1	3	2	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
364	1	3	3	9	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
365	1	3	4	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
366	1	3	5	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
367	1	3	6	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
368	1	3	7	5	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
369	1	4	0	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
370	1	4	1	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
371	1	4	2	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
372	1	4	3	9	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
373	1	4	4	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
374	1	4	5	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
375	1	4	6	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
376	1	4	7	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
377	1	5	0	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
378	1	5	1	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
379	1	5	2	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
380	1	5	3	9	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
381	1	5	4	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
382	1	5	5	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
383	1	5	6	1	\N	f	t	f	f	\N	2026-03-08 17:11:57.880657
384	1	5	7	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
385	1	6	0	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
386	1	6	1	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
387	1	6	2	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
388	1	6	3	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
389	1	6	4	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
390	1	6	5	11	\N	f	f	f	f	\N	2026-03-08 17:11:57.880657
391	1	6	6	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
392	1	6	7	\N	\N	t	f	f	f	\N	2026-03-08 17:11:57.880657
\.


--
-- TOC entry 5352 (class 0 OID 33088)
-- Dependencies: 250
-- Data for Name: lab_layout_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_layout_templates (layout_id, layout_name, description, rows, columns, created_by, created_at, updated_at) FROM stdin;
1	309 - Sensor Lab	\N	7	8	\N	2026-03-08 16:41:19.392277	2026-03-08 17:11:57.880657
2	317 - Security Lab	\N	7	7	\N	2026-03-12 13:36:56.50602	2026-03-12 13:36:56.50602
\.


--
-- TOC entry 5344 (class 0 OID 24890)
-- Dependencies: 242
-- Data for Name: lab_station_devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_station_devices (id, station_id, device_id, device_type, brand, model, specification, invoice_number, bill_id, is_linked, linked_group_id, created_at) FROM stdin;
1489	1043	717	AC	Blue Star		Blue Star AC	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1490	1044	721	Smart Board	Samsung		Samsung smart board	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1491	1046	718	AC	Blue Star		Blue Star AC	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1492	1048	502	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1493	1048	642	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1494	1048	667	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1495	1048	692	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1496	1049	503	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1497	1049	643	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1498	1049	668	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1499	1049	693	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1500	1051	504	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1501	1051	644	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1502	1051	669	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1503	1051	694	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1504	1052	505	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1505	1052	645	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1506	1052	670	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1507	1052	695	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1508	1053	506	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1509	1053	646	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1510	1053	671	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1511	1053	696	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1512	1054	507	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1513	1054	647	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1514	1054	672	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1515	1054	697	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1516	1055	508	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1517	1055	648	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1518	1055	673	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1519	1055	698	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1520	1057	509	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1521	1057	649	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1522	1057	674	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1523	1057	699	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1524	1058	510	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1525	1058	650	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1526	1058	675	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1527	1058	700	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1528	1059	511	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1529	1059	651	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1530	1059	676	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1531	1059	701	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1532	1061	512	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1533	1061	652	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1534	1061	677	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1535	1061	702	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1536	1062	513	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1537	1062	653	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1538	1062	678	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1539	1062	703	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1540	1064	514	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1541	1064	654	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1542	1064	679	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1543	1064	704	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1544	1065	515	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1545	1065	655	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1546	1065	680	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1547	1065	705	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1548	1066	516	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1549	1066	656	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1550	1066	681	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1551	1066	706	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1552	1068	517	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1553	1068	657	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1554	1068	682	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1555	1068	707	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1556	1069	518	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1557	1069	658	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1558	1069	683	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1559	1069	708	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1560	1071	519	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1561	1071	659	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1562	1071	684	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1563	1071	709	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1564	1072	520	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1565	1072	660	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1566	1072	685	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1567	1072	710	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1568	1073	521	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1569	1073	661	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1570	1073	686	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1571	1073	711	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1572	1074	522	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1574	1074	687	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1575	1074	712	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1576	1075	523	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1577	1075	663	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1578	1075	688	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1579	1075	713	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1580	1077	524	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1581	1077	664	Monitor	HP	abc-123	Led Monitor HP 23.8"	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1583	1077	714	Mouse	Logitech		Logitech mouse	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1584	1078	525	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-03-15 05:13:10.05768
1586	1078	690	Keyboard	Logitech		Logitech keyboard	INV-4213	9	f	\N	2026-03-15 05:13:10.05768
1599	1074	557	Monitor	Hp		Led Monitor HP 23.8"	TTS/22-23	8	f	\N	2026-03-15 05:17:28.198066
1600	1078	558	Monitor	Hp		Led Monitor HP 23.8"	TTS/22-23	8	f	\N	2026-03-15 05:17:28.198066
1642	1153	526	PC	Hp		Computer System Branded-HP	TTS/22-23	8	f	\N	2026-04-02 21:02:02.977777
1643	1153	560	Monitor	Hp		Led Monitor HP 23.8"	TTS/22-23	8	f	\N	2026-04-02 21:02:02.977777
\.


--
-- TOC entry 5342 (class 0 OID 24874)
-- Dependencies: 240
-- Data for Name: lab_stations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_stations (station_id, lab_id, assigned_code, row_number, column_number, created_at, station_qr_value) FROM stdin;
1042	309	309/ST-1	0	0	2026-03-15 05:13:10.05768	\N
1045	309	309/ST-4	0	5	2026-03-15 05:13:10.05768	\N
1047	309	309/ST-6	0	7	2026-03-15 05:13:10.05768	\N
1050	309	309/ST-9	1	3	2026-03-15 05:13:10.05768	\N
1056	309	309/ST-15	2	3	2026-03-15 05:13:10.05768	\N
1147	317	317/ST-1	0	0	2026-04-02 21:02:02.977777	\N
1060	309	309/ST-19	3	0	2026-03-15 05:13:10.05768	\N
1148	317	317/ST-2	0	1	2026-04-02 21:02:02.977777	\N
1149	317	317/ST-3	0	2	2026-04-02 21:02:02.977777	\N
1063	309	309/ST-22	3	3	2026-03-15 05:13:10.05768	\N
1150	317	317/ST-4	0	6	2026-04-02 21:02:02.977777	\N
1151	317	317/ST-5	1	0	2026-04-02 21:02:02.977777	\N
1152	317	317/ST-6	1	1	2026-04-02 21:02:02.977777	\N
1067	309	309/ST-26	3	7	2026-03-15 05:13:10.05768	\N
1153	317	317/ST-7	1	2	2026-04-02 21:02:02.977777	STATION|317/ST-7|APSIT/317/PC/6,APSIT/317/MON/1
1154	317	317/ST-8	1	3	2026-04-02 21:02:02.977777	\N
1070	309	309/ST-29	4	3	2026-03-15 05:13:10.05768	\N
1155	317	317/ST-9	1	4	2026-04-02 21:02:02.977777	\N
1156	317	317/ST-10	1	5	2026-04-02 21:02:02.977777	\N
1157	317	317/ST-11	1	6	2026-04-02 21:02:02.977777	\N
1158	317	317/ST-12	2	1	2026-04-02 21:02:02.977777	\N
1159	317	317/ST-13	2	2	2026-04-02 21:02:02.977777	\N
1160	317	317/ST-14	2	3	2026-04-02 21:02:02.977777	\N
1161	317	317/ST-15	2	4	2026-04-02 21:02:02.977777	\N
1162	317	317/ST-16	2	5	2026-04-02 21:02:02.977777	\N
1163	317	317/ST-17	2	6	2026-04-02 21:02:02.977777	\N
1164	317	317/ST-18	3	1	2026-04-02 21:02:02.977777	\N
1076	309	309/ST-35	5	3	2026-03-15 05:13:10.05768	\N
1165	317	317/ST-19	3	2	2026-04-02 21:02:02.977777	\N
1166	317	317/ST-20	3	3	2026-04-02 21:02:02.977777	\N
1167	317	317/ST-21	3	4	2026-04-02 21:02:02.977777	\N
1168	317	317/ST-22	3	5	2026-04-02 21:02:02.977777	\N
1169	317	317/ST-23	4	1	2026-04-02 21:02:02.977777	\N
1170	317	317/ST-24	4	2	2026-04-02 21:02:02.977777	\N
1080	309	309/ST-39	6	5	2026-03-15 05:13:10.05768	\N
1171	317	317/ST-25	4	3	2026-04-02 21:02:02.977777	\N
1172	317	317/ST-26	4	4	2026-04-02 21:02:02.977777	\N
1173	317	317/ST-27	4	5	2026-04-02 21:02:02.977777	\N
1043	309	309/ST-2	0	1	2026-03-15 05:13:10.05768	STATION|309/ST-2| APSIT/309/AC/1
1044	309	309/ST-3	0	3	2026-03-15 05:13:10.05768	STATION|309/ST-3| APSIT/309/SB/1
1046	309	309/ST-5	0	6	2026-03-15 05:13:10.05768	STATION|309/ST-5| APSIT/309/AC/2
1048	309	309/ST-7	1	1	2026-03-15 05:13:10.05768	STATION|309/ST-7| APSIT/309/PC/1, APSIT/309/MON/1, APSIT/309/KB/1, APSIT/309/MS/1
1049	309	309/ST-8	1	2	2026-03-15 05:13:10.05768	STATION|309/ST-8| APSIT/309/PC/2, APSIT/309/MON/2, APSIT/309/KB/2, APSIT/309/MS/2
1051	309	309/ST-10	1	4	2026-03-15 05:13:10.05768	STATION|309/ST-10| APSIT/309/PC/3, APSIT/309/MON/3, APSIT/309/KB/3, APSIT/309/MS/3
1052	309	309/ST-11	1	5	2026-03-15 05:13:10.05768	STATION|309/ST-11| APSIT/309/PC/4, APSIT/309/MON/4, APSIT/309/KB/4, APSIT/309/MS/4
1053	309	309/ST-12	1	6	2026-03-15 05:13:10.05768	STATION|309/ST-12| APSIT/309/PC/5, APSIT/309/MON/5, APSIT/309/KB/5, APSIT/309/MS/5
1054	309	309/ST-13	2	1	2026-03-15 05:13:10.05768	STATION|309/ST-13| APSIT/309/PC/6, APSIT/309/MON/6, APSIT/309/KB/6, APSIT/309/MS/6
1055	309	309/ST-14	2	2	2026-03-15 05:13:10.05768	STATION|309/ST-14| APSIT/309/PC/7, APSIT/309/MON/7, APSIT/309/KB/7, APSIT/309/MS/7
1057	309	309/ST-16	2	4	2026-03-15 05:13:10.05768	STATION|309/ST-16| APSIT/309/PC/8, APSIT/309/MON/8, APSIT/309/KB/8, APSIT/309/MS/8
1058	309	309/ST-17	2	5	2026-03-15 05:13:10.05768	STATION|309/ST-17| APSIT/309/PC/9, APSIT/309/MON/9, APSIT/309/KB/9, APSIT/309/MS/9
1059	309	309/ST-18	2	6	2026-03-15 05:13:10.05768	STATION|309/ST-18| APSIT/309/PC/10, APSIT/309/MON/10, APSIT/309/KB/10, APSIT/309/MS/10
1061	309	309/ST-20	3	1	2026-03-15 05:13:10.05768	STATION|309/ST-20| APSIT/309/PC/11, APSIT/309/MON/11, APSIT/309/KB/11, APSIT/309/MS/11
1062	309	309/ST-21	3	2	2026-03-15 05:13:10.05768	STATION|309/ST-21| APSIT/309/PC/12, APSIT/309/MON/12, APSIT/309/KB/12, APSIT/309/MS/12
1064	309	309/ST-23	3	4	2026-03-15 05:13:10.05768	STATION|309/ST-23| APSIT/309/PC/13, APSIT/309/MON/13, APSIT/309/KB/13, APSIT/309/MS/13
1065	309	309/ST-24	3	5	2026-03-15 05:13:10.05768	STATION|309/ST-24| APSIT/309/PC/14, APSIT/309/MON/14, APSIT/309/KB/14, APSIT/309/MS/14
1066	309	309/ST-25	3	6	2026-03-15 05:13:10.05768	STATION|309/ST-25| APSIT/309/PC/15, APSIT/309/MON/15, APSIT/309/KB/15, APSIT/309/MS/15
1068	309	309/ST-27	4	1	2026-03-15 05:13:10.05768	STATION|309/ST-27| APSIT/309/PC/16, APSIT/309/MON/16, APSIT/309/KB/16, APSIT/309/MS/16
1174	317	317/ST-28	5	1	2026-04-02 21:02:02.977777	\N
1175	317	317/ST-29	5	2	2026-04-02 21:02:02.977777	\N
1176	317	317/ST-30	5	3	2026-04-02 21:02:02.977777	\N
1177	317	317/ST-31	5	4	2026-04-02 21:02:02.977777	\N
1178	317	317/ST-32	5	5	2026-04-02 21:02:02.977777	\N
1179	317	317/ST-33	6	1	2026-04-02 21:02:02.977777	\N
1069	309	309/ST-28	4	2	2026-03-15 05:13:10.05768	STATION|309/ST-28| APSIT/309/PC/17, APSIT/309/MON/17, APSIT/309/KB/17, APSIT/309/MS/17
1071	309	309/ST-30	4	4	2026-03-15 05:13:10.05768	STATION|309/ST-30| APSIT/309/PC/18, APSIT/309/MON/18, APSIT/309/KB/18, APSIT/309/MS/18
1072	309	309/ST-31	4	5	2026-03-15 05:13:10.05768	STATION|309/ST-31| APSIT/309/PC/19, APSIT/309/MON/19, APSIT/309/KB/19, APSIT/309/MS/19
1073	309	309/ST-32	4	6	2026-03-15 05:13:10.05768	STATION|309/ST-32| APSIT/309/PC/20, APSIT/309/MON/20, APSIT/309/KB/20, APSIT/309/MS/20
1074	309	309/ST-33	5	1	2026-03-15 05:13:10.05768	STATION|309/ST-33| APSIT/309/PC/21, APSIT/309/KB/21, APSIT/309/MS/21, APSIT/309/MON/26
1075	309	309/ST-34	5	2	2026-03-15 05:13:10.05768	STATION|309/ST-34| APSIT/309/PC/22, APSIT/309/MON/22, APSIT/309/KB/22, APSIT/309/MS/22
1077	309	309/ST-36	5	4	2026-03-15 05:13:10.05768	STATION|309/ST-36| APSIT/309/PC/23, APSIT/309/MON/23, APSIT/309/MS/23
1078	309	309/ST-37	5	5	2026-03-15 05:13:10.05768	STATION|309/ST-37| APSIT/309/PC/24, APSIT/309/KB/24, APSIT/309/MS/24, APSIT/309/MON/27
1079	309	309/ST-38	5	6	2026-03-15 05:13:10.05768	STATION|None| APSIT/309/PC/26, APSIT/309/MON/28
\.


--
-- TOC entry 5328 (class 0 OID 24602)
-- Dependencies: 226
-- Data for Name: labs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.labs (id, lab_id, lab_name, rows, columns, layout_id, lab_public_token) FROM stdin;
8	309	Sensor Lab	7	8	1	556feb26ecd54a729ba36b14ac277231
9	317	Security Lab	7	7	2	257231fa1e854aeea153b02d0dcd870f
\.


--
-- TOC entry 5324 (class 0 OID 16411)
-- Dependencies: 222
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, token, expires_at, used, created_at) FROM stdin;
\.


--
-- TOC entry 5357 (class 0 OID 33345)
-- Dependencies: 255
-- Data for Name: scrap_register; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scrap_register (scrap_id, device_id, asset_code, device_type, brand, model, specification, lab_id, station_code, scrapped_by_text, scrapped_by_user_id, scrapped_at) FROM stdin;
\.


--
-- TOC entry 5360 (class 0 OID 33408)
-- Dependencies: 258
-- Data for Name: scrap_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scrap_requests (scrap_request_id, device_ids, lab_id, status, remark, requested_by, requested_by_user_id, requested_at, approved_by, approved_at) FROM stdin;
1	[731]	309	approved	abcd	mayanksalvi312@gmail.com	4	2026-03-27 13:58:30.02489+05:30	dhanashreemayank@gmail.com	2026-03-27 14:00:11.398404+05:30
2	[739]	309	approved	abcd	dhanashreemayank@gmail.com	1	2026-03-27 14:04:02.546554+05:30	dhanashreemayank@gmail.com	2026-03-27 14:04:17.687472+05:30
3	[740]	309	approved		dhanashreemayank@gmail.com	1	2026-03-27 14:09:59.233816+05:30	dhanashreemayank@gmail.com	2026-03-27 14:10:21.426708+05:30
4	[559, 527]	309	approved	abcd	mayanksalvi312@gmail.com	4	2026-04-01 14:23:04.778929+05:30	dhanashreemayank@gmail.com	2026-04-01 16:31:51.55571+05:30
5	[715]	309	approved		mayanksalvi312@gmail.com	4	2026-04-01 17:48:04.324338+05:30	dhanashreemayank@gmail.com	2026-04-01 17:48:53.665668+05:30
\.


--
-- TOC entry 5358 (class 0 OID 33353)
-- Dependencies: 256
-- Data for Name: scrapped_devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scrapped_devices (id, device_id, lab_id, station_id, scrapped_by, scrapped_at, reason, notes, created_at, updated_at, asset_code, device_type, brand, model, specification, station_code, scrapped_by_text, scrapped_by_user_id, lab_name, dead_stock_number, cost, justification_for_scrapping, scrap_id) FROM stdin;
1	628	302	\N	\N	2026-03-17 15:48:45.152408	\N	\N	2026-03-17 15:48:45.152408	2026-03-17 15:48:45.152408	\N	PC	Dell	OptiPlex 7000	Core i7, 16GB RAM, 512GB SSD	302/ST-22	salvimayank40@gmail.com	3	\N	\N	\N	\N	\N
2	626	302	\N	\N	2026-03-17 15:48:45.152408	\N	\N	2026-03-17 15:48:45.152408	2026-03-17 15:48:45.152408	\N	PC	Dell	OptiPlex 7000	Core i7, 16GB RAM, 512GB SSD	302/ST-19	salvimayank40@gmail.com	3	\N	\N	\N	\N	\N
3	625	302	\N	\N	2026-03-17 15:48:45.152408	\N	\N	2026-03-17 15:48:45.152408	2026-03-17 15:48:45.152408	\N	PC	Dell	OptiPlex 7000	Core i7, 16GB RAM, 512GB SSD	302/ST-18	salvimayank40@gmail.com	3	\N	\N	\N	\N	\N
4	552	302	\N	\N	2026-03-17 15:54:18.461807	\N	\N	2026-03-17 15:54:18.461807	2026-03-17 15:54:18.461807	/CO/51	PC	Hp		Computer System Branded-HP	302/ST-8	salvimayank40@gmail.com	3	\N	\N	\N	\N	\N
5	652	302	\N	\N	2026-03-17 15:55:13.950705	\N	\N	2026-03-17 15:55:13.950705	2026-03-17 15:55:13.950705	apsit/1/m/3	Mouse	dell	op-17	dawdda	302/ST-8	salvimayank40@gmail.com	3	\N	\N	\N	\N	\N
6	631	302	\N	\N	2026-03-17 16:00:21.968985	\N	\N	2026-03-17 16:00:21.968985	2026-03-17 16:00:21.968985	\N	PC	Dell	OptiPlex 7000	Core i7, 16GB RAM, 512GB SSD	302/ST-26	salvimayank40@gmail.com	3	\N	\N	\N	\N	\N
7	553	302	\N	\N	2026-03-17 16:12:48.731336	\N	\N	2026-03-17 16:12:48.731336	2026-03-17 16:12:48.731336	/CO/52	PC	Hp		Computer System Branded-HP	302/ST-10	salvimayank40@gmail.com	3	\N	\N	\N	\N	\N
8	651	302	\N	\N	2026-03-17 16:15:39.078629	\N	\N	2026-03-17 16:15:39.078629	2026-03-17 16:15:39.078629	apsit/1/m/2	Mouse	dell	op-17	dawdda	302/ST-7	salvimayank40@gmail.com	3	\N	\N	\N	\N	\N
14	559	309	\N	\N	2026-04-01 16:31:51.55571	\N	\N	2026-04-01 16:31:51.55571	2026-04-01 16:31:51.55571	/MO/58	Monitor	Hp		Led Monitor HP 23.8"	309/ST-38	dhanashreemayank@gmail.com	1	Sensor Lab	/MO/58	14200	abcd	\N
15	527	309	\N	\N	2026-04-01 16:31:51.55571	\N	\N	2026-04-01 16:31:51.55571	2026-04-01 16:31:51.55571	/CO/26	PC	Hp		Computer System Branded-HP	309/ST-38	dhanashreemayank@gmail.com	1	Sensor Lab	/CO/26	40000	abcd	\N
16	715	309	1078	1	2026-04-01 17:48:53.665668	\N	\N	2026-04-01 17:48:53.665668	2026-04-01 17:48:53.665668	IT/MO/74	Mouse	Logitech		Logitech mouse	309/ST-37	dhanashreemayank@gmail.com	1	Sensor Lab	IT/MO/74	300	\N	IT/MO/74
\.


--
-- TOC entry 5350 (class 0 OID 33073)
-- Dependencies: 248
-- Data for Name: station_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.station_types (station_type_id, name, description, icon, color, allowed_device_types, created_at) FROM stdin;
1	Computer Station	Desktop PC setup with monitor, keyboard, mouse	🖥️	#3B82F6	{PC,Monitor,Keyboard,Mouse,UPS,Headset,Webcam}	2026-02-27 21:30:16.588849
2	Laptop Station	Laptop workstation	💻	#8B5CF6	{Laptop,Mouse,Headset,Webcam}	2026-02-27 21:30:16.588849
3	Server Rack	Server equipment area	🖧	#EF4444	{Server,UPS,Switch,Router}	2026-02-27 21:30:16.588849
4	AC Unit	Air conditioning unit placement	❄️	#06B6D4	{AC}	2026-02-27 21:30:16.588849
5	Network Equipment	Router, switch, or networking gear	📡	#F59E0B	{Router,Switch}	2026-02-27 21:30:16.588849
6	Projector Setup	Projector or smart board area	📽️	#10B981	{Projector,"Smart Board"}	2026-02-27 21:30:16.588849
7	Printer Station	Printer and scanner area	🖨️	#EC4899	{Printer,Scanner}	2026-02-27 21:30:16.588849
8	UPS Station	Dedicated UPS placement	🔋	#6366F1	{UPS}	2026-02-27 21:30:16.588849
9	Passage	Walkway or empty passage (no devices)	🚶	#6B7280	{}	2026-02-27 21:30:16.588849
10	Other	Custom or miscellaneous equipment	📦	#78716C	{Other}	2026-02-27 21:30:16.588849
11	Door	Entry point of the Lab	🚪	#6B7280	{}	2026-02-27 21:30:16.588849
13	CCTV camera	The cctv cameras in the lab	👁️‍🗨️	#EF4444	{CCTV}	2026-03-08 16:27:52.894472
12	Smart Board	Smart Board placement	📟	#8B5CF6	{"Smart Board"}	2026-03-08 16:40:20.046791
\.


--
-- TOC entry 5367 (class 0 OID 33510)
-- Dependencies: 265
-- Data for Name: student_email_verification_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.student_email_verification_codes (id, email, code_hash, created_at, expires_at, used_at, attempts) FROM stdin;
1	mayanksalvi180@apsit.edu.in	$2b$12$9IRu0Vfp3H06pRhZoxmPZO8kBLB2jqxlkoHJifjsb7T3j1BHLwHSm	2026-06-02 20:29:56.162485	2026-06-02 15:09:56.391755	2026-06-02 15:00:15.750717	0
\.


--
-- TOC entry 5363 (class 0 OID 33446)
-- Dependencies: 261
-- Data for Name: student_issue_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.student_issue_requests (request_id, lab_id, station_id, device_id, student_name, student_email, issue_title, issue_description, severity, status, approved_by, approved_at, approved_issue_id, rejection_note, created_at) FROM stdin;
1	309	1043	717	mayank	mayanksalvi180@apsit.edu.in	Not working	AC not working properly	high	approved	salvi mayank	2026-06-02 20:16:28.370606	19	\N	2026-06-02 20:15:56.06945
2	309	1043	717	mayank	mayanksalvi180@apsit.edu.in	Not working	AC not working properly	high	approved	salvi mayank	2026-06-02 21:14:27.592717	20	\N	2026-06-02 20:30:15.895732
\.


--
-- TOC entry 5348 (class 0 OID 33028)
-- Dependencies: 246
-- Data for Name: transfer_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transfer_requests (transfer_id, from_lab_id, to_lab_id, device_ids, remark, status, requested_by, requested_at, approved_by, approved_at, transfer_type, station_ids, dest_cell_id, device_dest_map) FROM stdin;
4	309	317	[691, 666, 526, 665]	test	approved	mayanksalvi312@gmail.com	2026-03-15 04:22:50.693962	dhanashreemayank@gmail.com	2026-03-15 04:27:36.118862	station	[880]	433	{"526": 433, "665": 432, "666": 433, "691": 433}
5	317	309	[665, 691, 666, 526]		approved	dhanashreemayank@gmail.com	2026-03-15 04:29:12.856653	dhanashreemayank@gmail.com	2026-03-15 04:31:31.576813	station	[882]	383	{"526": 383, "665": 382, "666": 383, "691": 383}
6	309	317	[691, 666, 526]		approved	salvimayank40@gmail.com	2026-03-15 04:38:17.628093	dhanashreemayank@gmail.com	2026-03-15 04:38:49.315887	station	[880]	433	{"526": 433, "666": 433, "691": 433}
7	309	317	[691, 666, 716, 526, 665]		approved	dhanashreemayank@gmail.com	2026-03-15 04:54:45.411154	dhanashreemayank@gmail.com	2026-03-15 04:54:50.933737	station	[960]	433	{"526": 433, "665": 432, "666": 433, "691": 433, "716": 433}
8	309	317	[691, 666, 716, 526, 665, 662, 689]		approved	mayanksalvi312@gmail.com	2026-03-15 05:16:03.133746	dhanashreemayank@gmail.com	2026-03-15 05:16:11.549293	station	[1079]	433	{"526": 433, "662": 431, "665": 432, "666": 433, "689": 432, "691": 433, "716": 433}
\.


--
-- TOC entry 5326 (class 0 OID 16431)
-- Dependencies: 224
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_sessions (id, user_id, session_token, expires_at, created_at, last_accessed) FROM stdin;
\.


--
-- TOC entry 5322 (class 0 OID 16390)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, first_name, last_name, email, password_hash, role, assigned_lab, access_scope, is_active, email_verified, email_verified_at, created_at, updated_at, last_login) FROM stdin;
2	pawan	walke	pawan@gmail.com	$2b$12$i5oR8K8x9TxinKhyaNHWVOGh6jTH.qwZ3Mdq.mJvKCc2siz9ylMWS	Lab Incharge	317	{"lab": "317", "type": "single"}	t	f	\N	2025-10-06 10:51:48.503774+05:30	2025-10-06 10:51:48.503774+05:30	\N
4	mayank	salvi	mayanksalvi312@gmail.com	$2b$12$H3D0iNWAua9lj/HoHXmjkeNnzoQOiJPKPCaTTwaeqyse/bd5qXtMy	Lab Incharge	309	{"lab": "309", "type": "single"}	t	f	\N	2026-02-03 02:39:33.792061+05:30	2026-02-03 02:39:33.792061+05:30	2026-04-07 12:30:03.051269+05:30
3	mayank	salvi	salvimayank40@gmail.com	$2b$12$mATS9S8BBR66OjiN2yb3dumygldgLKFBeSZ6T6Wwu2cTWx2wCruX.	Lab Assistant	\N	{"type": "all"}	t	f	\N	2026-02-03 02:22:13.499505+05:30	2026-02-03 02:22:13.499505+05:30	2026-04-26 14:25:24.052904+05:30
1	mayank	salvi	dhanashreemayank@gmail.com	$2b$12$4UyAFh881myVGuUj2u/Cne9pYl0SwYVp/N1VlMJ4Vbycas8OfuNVi	HOD	\N	{"type": "all"}	t	f	\N	2025-10-05 03:02:11.502987+05:30	2025-10-05 03:02:11.502987+05:30	2026-06-02 19:46:14.243964+05:30
5	salvi	mayank	mayanksalvi180@apsit.edu.in	$2b$12$Q./GOx0PJ.6sEBaJMKshcOwvqc5gOyp8nfRKAtRVjM.8076RRs.eK	Lab Assistant	\N	{"type": "all"}	t	t	2026-06-02 14:35:55.386164+05:30	2026-06-02 20:05:55.423332+05:30	2026-06-02 20:05:55.423332+05:30	2026-06-02 20:07:52.377533+05:30
\.


--
-- TOC entry 5446 (class 0 OID 0)
-- Dependencies: 229
-- Name: bills_bill_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bills_bill_id_seq', 13, true);


--
-- TOC entry 5447 (class 0 OID 0)
-- Dependencies: 253
-- Name: device_code_counters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.device_code_counters_id_seq', 153, true);


--
-- TOC entry 5448 (class 0 OID 0)
-- Dependencies: 236
-- Name: device_issue_history_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.device_issue_history_history_id_seq', 33, true);


--
-- TOC entry 5449 (class 0 OID 0)
-- Dependencies: 234
-- Name: device_issues_issue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.device_issues_issue_id_seq', 20, true);


--
-- TOC entry 5450 (class 0 OID 0)
-- Dependencies: 231
-- Name: devices_device_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.devices_device_id_seq', 908, true);


--
-- TOC entry 5451 (class 0 OID 0)
-- Dependencies: 262
-- Name: email_verification_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.email_verification_codes_id_seq', 1, true);


--
-- TOC entry 5452 (class 0 OID 0)
-- Dependencies: 227
-- Name: equipment_types_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.equipment_types_type_id_seq', 17, true);


--
-- TOC entry 5453 (class 0 OID 0)
-- Dependencies: 243
-- Name: lab_equipment_pool_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lab_equipment_pool_id_seq', 205, true);


--
-- TOC entry 5454 (class 0 OID 0)
-- Dependencies: 238
-- Name: lab_grid_cells_cell_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lab_grid_cells_cell_id_seq', 2578, true);


--
-- TOC entry 5455 (class 0 OID 0)
-- Dependencies: 251
-- Name: lab_layout_cells_cell_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lab_layout_cells_cell_id_seq', 441, true);


--
-- TOC entry 5456 (class 0 OID 0)
-- Dependencies: 249
-- Name: lab_layout_templates_layout_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lab_layout_templates_layout_id_seq', 2, true);


--
-- TOC entry 5457 (class 0 OID 0)
-- Dependencies: 241
-- Name: lab_station_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lab_station_devices_id_seq', 1643, true);


--
-- TOC entry 5458 (class 0 OID 0)
-- Dependencies: 239
-- Name: lab_stations_station_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lab_stations_station_id_seq', 1179, true);


--
-- TOC entry 5459 (class 0 OID 0)
-- Dependencies: 225
-- Name: labs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.labs_id_seq', 9, true);


--
-- TOC entry 5460 (class 0 OID 0)
-- Dependencies: 221
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- TOC entry 5461 (class 0 OID 0)
-- Dependencies: 259
-- Name: scrap_requests_scrap_request_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.scrap_requests_scrap_request_id_seq', 5, true);


--
-- TOC entry 5462 (class 0 OID 0)
-- Dependencies: 257
-- Name: scrapped_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.scrapped_devices_id_seq', 16, true);


--
-- TOC entry 5463 (class 0 OID 0)
-- Dependencies: 247
-- Name: station_types_station_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.station_types_station_type_id_seq', 10, true);


--
-- TOC entry 5464 (class 0 OID 0)
-- Dependencies: 264
-- Name: student_email_verification_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.student_email_verification_codes_id_seq', 1, true);


--
-- TOC entry 5465 (class 0 OID 0)
-- Dependencies: 260
-- Name: student_issue_requests_request_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.student_issue_requests_request_id_seq', 2, true);


--
-- TOC entry 5466 (class 0 OID 0)
-- Dependencies: 245
-- Name: transfer_requests_transfer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transfer_requests_transfer_id_seq', 8, true);


--
-- TOC entry 5467 (class 0 OID 0)
-- Dependencies: 223
-- Name: user_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_sessions_id_seq', 1, false);


--
-- TOC entry 5468 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- TOC entry 5079 (class 2606 OID 24692)
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (bill_id);


--
-- TOC entry 5081 (class 2606 OID 24822)
-- Name: bills bills_vendor_invoice_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_vendor_invoice_unique UNIQUE (vendor_name, invoice_number);


--
-- TOC entry 5119 (class 2606 OID 33302)
-- Name: device_code_counters device_code_counters_lab_id_device_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_code_counters
    ADD CONSTRAINT device_code_counters_lab_id_device_type_key UNIQUE (lab_id, device_type);


--
-- TOC entry 5121 (class 2606 OID 33300)
-- Name: device_code_counters device_code_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_code_counters
    ADD CONSTRAINT device_code_counters_pkey PRIMARY KEY (id);


--
-- TOC entry 5091 (class 2606 OID 24812)
-- Name: device_issue_history device_issue_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_issue_history
    ADD CONSTRAINT device_issue_history_pkey PRIMARY KEY (history_id);


--
-- TOC entry 5089 (class 2606 OID 24795)
-- Name: device_issues device_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_issues
    ADD CONSTRAINT device_issues_pkey PRIMARY KEY (issue_id);


--
-- TOC entry 5083 (class 2606 OID 24706)
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (device_id);


--
-- TOC entry 5141 (class 2606 OID 33507)
-- Name: email_verification_codes email_verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verification_codes
    ADD CONSTRAINT email_verification_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 5075 (class 2606 OID 24633)
-- Name: equipment_types equipment_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_types
    ADD CONSTRAINT equipment_types_name_key UNIQUE (name);


--
-- TOC entry 5077 (class 2606 OID 24631)
-- Name: equipment_types equipment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_types
    ADD CONSTRAINT equipment_types_pkey PRIMARY KEY (type_id);


--
-- TOC entry 5099 (class 2606 OID 24923)
-- Name: lab_equipment_pool lab_equipment_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_equipment_pool
    ADD CONSTRAINT lab_equipment_pool_pkey PRIMARY KEY (id);


--
-- TOC entry 5085 (class 2606 OID 24861)
-- Name: lab_grid_cells lab_grid_cells_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_grid_cells
    ADD CONSTRAINT lab_grid_cells_pkey PRIMARY KEY (cell_id);


--
-- TOC entry 5115 (class 2606 OID 33121)
-- Name: lab_layout_cells lab_layout_cells_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_layout_cells
    ADD CONSTRAINT lab_layout_cells_pkey PRIMARY KEY (cell_id);


--
-- TOC entry 5111 (class 2606 OID 33103)
-- Name: lab_layout_templates lab_layout_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_layout_templates
    ADD CONSTRAINT lab_layout_templates_pkey PRIMARY KEY (layout_id);


--
-- TOC entry 5097 (class 2606 OID 24900)
-- Name: lab_station_devices lab_station_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_station_devices
    ADD CONSTRAINT lab_station_devices_pkey PRIMARY KEY (id);


--
-- TOC entry 5093 (class 2606 OID 24883)
-- Name: lab_stations lab_stations_assigned_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_stations
    ADD CONSTRAINT lab_stations_assigned_code_key UNIQUE (assigned_code);


--
-- TOC entry 5095 (class 2606 OID 24881)
-- Name: lab_stations lab_stations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_stations
    ADD CONSTRAINT lab_stations_pkey PRIMARY KEY (station_id);


--
-- TOC entry 5071 (class 2606 OID 24615)
-- Name: labs labs_lab_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs
    ADD CONSTRAINT labs_lab_id_key UNIQUE (lab_id);


--
-- TOC entry 5073 (class 2606 OID 24611)
-- Name: labs labs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs
    ADD CONSTRAINT labs_pkey PRIMARY KEY (id);


--
-- TOC entry 5064 (class 2606 OID 16423)
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 5125 (class 2606 OID 33385)
-- Name: scrap_register scrap_register_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scrap_register
    ADD CONSTRAINT scrap_register_pkey PRIMARY KEY (scrap_id);


--
-- TOC entry 5134 (class 2606 OID 33439)
-- Name: scrap_requests scrap_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scrap_requests
    ADD CONSTRAINT scrap_requests_pkey PRIMARY KEY (scrap_request_id);


--
-- TOC entry 5130 (class 2606 OID 33387)
-- Name: scrapped_devices scrapped_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scrapped_devices
    ADD CONSTRAINT scrapped_devices_pkey PRIMARY KEY (id);


--
-- TOC entry 5107 (class 2606 OID 33086)
-- Name: station_types station_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.station_types
    ADD CONSTRAINT station_types_name_key UNIQUE (name);


--
-- TOC entry 5109 (class 2606 OID 33084)
-- Name: station_types station_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.station_types
    ADD CONSTRAINT station_types_pkey PRIMARY KEY (station_type_id);


--
-- TOC entry 5145 (class 2606 OID 33525)
-- Name: student_email_verification_codes student_email_verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_email_verification_codes
    ADD CONSTRAINT student_email_verification_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 5139 (class 2606 OID 33467)
-- Name: student_issue_requests student_issue_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_issue_requests
    ADD CONSTRAINT student_issue_requests_pkey PRIMARY KEY (request_id);


--
-- TOC entry 5105 (class 2606 OID 33043)
-- Name: transfer_requests transfer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_pkey PRIMARY KEY (transfer_id);


--
-- TOC entry 5087 (class 2606 OID 24872)
-- Name: lab_grid_cells unique_lab_cell; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_grid_cells
    ADD CONSTRAINT unique_lab_cell UNIQUE (lab_id, row_number, column_number);


--
-- TOC entry 5117 (class 2606 OID 33123)
-- Name: lab_layout_cells unique_layout_cell; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_layout_cells
    ADD CONSTRAINT unique_layout_cell UNIQUE (layout_id, row_number, column_number);


--
-- TOC entry 5067 (class 2606 OID 16443)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 5060 (class 2606 OID 16408)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5142 (class 1259 OID 33508)
-- Name: idx_email_verification_codes_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_verification_codes_email ON public.email_verification_codes USING btree (email);


--
-- TOC entry 5068 (class 1259 OID 33444)
-- Name: idx_labs_lab_public_token_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_labs_lab_public_token_unique ON public.labs USING btree (lab_public_token) WHERE (lab_public_token IS NOT NULL);


--
-- TOC entry 5069 (class 1259 OID 33141)
-- Name: idx_labs_layout_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_labs_layout_id ON public.labs USING btree (layout_id);


--
-- TOC entry 5112 (class 1259 OID 33139)
-- Name: idx_layout_cells_layout_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_layout_cells_layout_id ON public.lab_layout_cells USING btree (layout_id);


--
-- TOC entry 5113 (class 1259 OID 33140)
-- Name: idx_layout_cells_station_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_layout_cells_station_type ON public.lab_layout_cells USING btree (station_type_id);


--
-- TOC entry 5062 (class 1259 OID 16429)
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- TOC entry 5122 (class 1259 OID 33388)
-- Name: idx_scrap_register_device_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_register_device_id ON public.scrap_register USING btree (device_id);


--
-- TOC entry 5123 (class 1259 OID 33389)
-- Name: idx_scrap_register_scrapped_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_register_scrapped_at ON public.scrap_register USING btree (scrapped_at DESC);


--
-- TOC entry 5131 (class 1259 OID 33440)
-- Name: idx_scrap_requests_requested_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_requests_requested_at ON public.scrap_requests USING btree (requested_at DESC);


--
-- TOC entry 5132 (class 1259 OID 33441)
-- Name: idx_scrap_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_requests_status ON public.scrap_requests USING btree (status);


--
-- TOC entry 5126 (class 1259 OID 33390)
-- Name: idx_scrapped_devices_device_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrapped_devices_device_id ON public.scrapped_devices USING btree (device_id);


--
-- TOC entry 5127 (class 1259 OID 33391)
-- Name: idx_scrapped_devices_lab_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrapped_devices_lab_id ON public.scrapped_devices USING btree (lab_id);


--
-- TOC entry 5128 (class 1259 OID 33392)
-- Name: idx_scrapped_devices_scrapped_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrapped_devices_scrapped_at ON public.scrapped_devices USING btree (scrapped_at);


--
-- TOC entry 5143 (class 1259 OID 33526)
-- Name: idx_student_email_verification_codes_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_email_verification_codes_email ON public.student_email_verification_codes USING btree (email);


--
-- TOC entry 5135 (class 1259 OID 33490)
-- Name: idx_student_issue_requests_device; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_issue_requests_device ON public.student_issue_requests USING btree (device_id);


--
-- TOC entry 5136 (class 1259 OID 33489)
-- Name: idx_student_issue_requests_lab_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_issue_requests_lab_status ON public.student_issue_requests USING btree (lab_id, status);


--
-- TOC entry 5137 (class 1259 OID 33488)
-- Name: idx_student_issue_requests_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_issue_requests_status_created ON public.student_issue_requests USING btree (status, created_at DESC);


--
-- TOC entry 5100 (class 1259 OID 33055)
-- Name: idx_transfer_from_lab; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transfer_from_lab ON public.transfer_requests USING btree (from_lab_id);


--
-- TOC entry 5101 (class 1259 OID 33057)
-- Name: idx_transfer_requested_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transfer_requested_at ON public.transfer_requests USING btree (requested_at DESC);


--
-- TOC entry 5102 (class 1259 OID 33054)
-- Name: idx_transfer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transfer_status ON public.transfer_requests USING btree (status);


--
-- TOC entry 5103 (class 1259 OID 33056)
-- Name: idx_transfer_to_lab; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transfer_to_lab ON public.transfer_requests USING btree (to_lab_id);


--
-- TOC entry 5065 (class 1259 OID 16449)
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- TOC entry 5061 (class 1259 OID 16409)
-- Name: ux_users_email_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_users_email_lower ON public.users USING btree (lower((email)::text));


--
-- TOC entry 5172 (class 2620 OID 33069)
-- Name: device_issues trg_set_bill_id_device_issues; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_bill_id_device_issues BEFORE INSERT ON public.device_issues FOR EACH ROW EXECUTE FUNCTION public.set_bill_id_for_device_issue();


--
-- TOC entry 5173 (class 2620 OID 33071)
-- Name: device_issue_history trg_set_bill_id_issue_history; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_bill_id_issue_history BEFORE INSERT ON public.device_issue_history FOR EACH ROW EXECUTE FUNCTION public.set_bill_id_for_issue_history();


--
-- TOC entry 5155 (class 2606 OID 33063)
-- Name: device_issue_history device_issue_history_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_issue_history
    ADD CONSTRAINT device_issue_history_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(bill_id) ON DELETE SET NULL;


--
-- TOC entry 5156 (class 2606 OID 24813)
-- Name: device_issue_history device_issue_history_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_issue_history
    ADD CONSTRAINT device_issue_history_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.device_issues(issue_id) ON DELETE CASCADE;


--
-- TOC entry 5153 (class 2606 OID 33058)
-- Name: device_issues device_issues_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_issues
    ADD CONSTRAINT device_issues_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(bill_id) ON DELETE SET NULL;


--
-- TOC entry 5154 (class 2606 OID 24796)
-- Name: device_issues device_issues_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_issues
    ADD CONSTRAINT device_issues_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(device_id) ON DELETE CASCADE;


--
-- TOC entry 5149 (class 2606 OID 24714)
-- Name: devices devices_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(bill_id) ON DELETE SET NULL;


--
-- TOC entry 5150 (class 2606 OID 24719)
-- Name: devices devices_lab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(lab_id);


--
-- TOC entry 5151 (class 2606 OID 24709)
-- Name: devices devices_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.equipment_types(type_id) ON DELETE RESTRICT;


--
-- TOC entry 5160 (class 2606 OID 24929)
-- Name: lab_equipment_pool lab_equipment_pool_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_equipment_pool
    ADD CONSTRAINT lab_equipment_pool_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(bill_id);


--
-- TOC entry 5161 (class 2606 OID 24924)
-- Name: lab_equipment_pool lab_equipment_pool_lab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_equipment_pool
    ADD CONSTRAINT lab_equipment_pool_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(lab_id);


--
-- TOC entry 5152 (class 2606 OID 24862)
-- Name: lab_grid_cells lab_grid_cells_lab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_grid_cells
    ADD CONSTRAINT lab_grid_cells_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(lab_id);


--
-- TOC entry 5164 (class 2606 OID 33124)
-- Name: lab_layout_cells lab_layout_cells_layout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_layout_cells
    ADD CONSTRAINT lab_layout_cells_layout_id_fkey FOREIGN KEY (layout_id) REFERENCES public.lab_layout_templates(layout_id) ON DELETE CASCADE;


--
-- TOC entry 5165 (class 2606 OID 33129)
-- Name: lab_layout_cells lab_layout_cells_station_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_layout_cells
    ADD CONSTRAINT lab_layout_cells_station_type_id_fkey FOREIGN KEY (station_type_id) REFERENCES public.station_types(station_type_id) ON DELETE SET NULL;


--
-- TOC entry 5158 (class 2606 OID 24906)
-- Name: lab_station_devices lab_station_devices_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_station_devices
    ADD CONSTRAINT lab_station_devices_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(bill_id);


--
-- TOC entry 5159 (class 2606 OID 24901)
-- Name: lab_station_devices lab_station_devices_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_station_devices
    ADD CONSTRAINT lab_station_devices_station_id_fkey FOREIGN KEY (station_id) REFERENCES public.lab_stations(station_id) ON DELETE CASCADE;


--
-- TOC entry 5157 (class 2606 OID 24884)
-- Name: lab_stations lab_stations_lab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_stations
    ADD CONSTRAINT lab_stations_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(lab_id);


--
-- TOC entry 5148 (class 2606 OID 33134)
-- Name: labs labs_layout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs
    ADD CONSTRAINT labs_layout_id_fkey FOREIGN KEY (layout_id) REFERENCES public.lab_layout_templates(layout_id) ON DELETE SET NULL;


--
-- TOC entry 5146 (class 2606 OID 16424)
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5166 (class 2606 OID 33398)
-- Name: scrapped_devices scrapped_devices_scrapped_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scrapped_devices
    ADD CONSTRAINT scrapped_devices_scrapped_by_fkey FOREIGN KEY (scrapped_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5167 (class 2606 OID 33403)
-- Name: scrapped_devices scrapped_devices_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scrapped_devices
    ADD CONSTRAINT scrapped_devices_station_id_fkey FOREIGN KEY (station_id) REFERENCES public.lab_stations(station_id) ON DELETE SET NULL;


--
-- TOC entry 5168 (class 2606 OID 33483)
-- Name: student_issue_requests student_issue_requests_approved_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_issue_requests
    ADD CONSTRAINT student_issue_requests_approved_issue_id_fkey FOREIGN KEY (approved_issue_id) REFERENCES public.device_issues(issue_id) ON DELETE SET NULL;


--
-- TOC entry 5169 (class 2606 OID 33478)
-- Name: student_issue_requests student_issue_requests_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_issue_requests
    ADD CONSTRAINT student_issue_requests_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(device_id) ON DELETE CASCADE;


--
-- TOC entry 5170 (class 2606 OID 33468)
-- Name: student_issue_requests student_issue_requests_lab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_issue_requests
    ADD CONSTRAINT student_issue_requests_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(lab_id) ON DELETE CASCADE;


--
-- TOC entry 5171 (class 2606 OID 33473)
-- Name: student_issue_requests student_issue_requests_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_issue_requests
    ADD CONSTRAINT student_issue_requests_station_id_fkey FOREIGN KEY (station_id) REFERENCES public.lab_stations(station_id) ON DELETE SET NULL;


--
-- TOC entry 5162 (class 2606 OID 33044)
-- Name: transfer_requests transfer_requests_from_lab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_from_lab_id_fkey FOREIGN KEY (from_lab_id) REFERENCES public.labs(lab_id);


--
-- TOC entry 5163 (class 2606 OID 33049)
-- Name: transfer_requests transfer_requests_to_lab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_to_lab_id_fkey FOREIGN KEY (to_lab_id) REFERENCES public.labs(lab_id);


--
-- TOC entry 5147 (class 2606 OID 16444)
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5373 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE bills; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bills TO assetiq_user;


--
-- TOC entry 5375 (class 0 OID 0)
-- Dependencies: 229
-- Name: SEQUENCE bills_bill_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.bills_bill_id_seq TO assetiq_user;


--
-- TOC entry 5376 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE device_code_counters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.device_code_counters TO assetiq_user;


--
-- TOC entry 5378 (class 0 OID 0)
-- Dependencies: 253
-- Name: SEQUENCE device_code_counters_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.device_code_counters_id_seq TO assetiq_user;


--
-- TOC entry 5379 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE device_issue_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.device_issue_history TO assetiq_user;


--
-- TOC entry 5381 (class 0 OID 0)
-- Dependencies: 236
-- Name: SEQUENCE device_issue_history_history_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.device_issue_history_history_id_seq TO assetiq_user;


--
-- TOC entry 5382 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE device_issues; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.device_issues TO assetiq_user;


--
-- TOC entry 5384 (class 0 OID 0)
-- Dependencies: 234
-- Name: SEQUENCE device_issues_issue_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.device_issues_issue_id_seq TO assetiq_user;


--
-- TOC entry 5385 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.devices TO assetiq_user;


--
-- TOC entry 5387 (class 0 OID 0)
-- Dependencies: 231
-- Name: SEQUENCE devices_device_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.devices_device_id_seq TO assetiq_user;


--
-- TOC entry 5388 (class 0 OID 0)
-- Dependencies: 263
-- Name: TABLE email_verification_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_verification_codes TO assetiq_user;


--
-- TOC entry 5390 (class 0 OID 0)
-- Dependencies: 262
-- Name: SEQUENCE email_verification_codes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.email_verification_codes_id_seq TO assetiq_user;


--
-- TOC entry 5391 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE equipment_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.equipment_types TO assetiq_user;


--
-- TOC entry 5393 (class 0 OID 0)
-- Dependencies: 227
-- Name: SEQUENCE equipment_types_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.equipment_types_type_id_seq TO assetiq_user;


--
-- TOC entry 5394 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE lab_equipment_pool; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_equipment_pool TO assetiq_user;


--
-- TOC entry 5396 (class 0 OID 0)
-- Dependencies: 243
-- Name: SEQUENCE lab_equipment_pool_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_equipment_pool_id_seq TO assetiq_user;


--
-- TOC entry 5397 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE lab_grid_cells; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_grid_cells TO assetiq_user;


--
-- TOC entry 5399 (class 0 OID 0)
-- Dependencies: 238
-- Name: SEQUENCE lab_grid_cells_cell_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_grid_cells_cell_id_seq TO assetiq_user;


--
-- TOC entry 5400 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE lab_layout_cells; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_layout_cells TO assetiq_user;


--
-- TOC entry 5402 (class 0 OID 0)
-- Dependencies: 251
-- Name: SEQUENCE lab_layout_cells_cell_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_layout_cells_cell_id_seq TO assetiq_user;


--
-- TOC entry 5403 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE lab_layout_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_layout_templates TO assetiq_user;


--
-- TOC entry 5405 (class 0 OID 0)
-- Dependencies: 249
-- Name: SEQUENCE lab_layout_templates_layout_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_layout_templates_layout_id_seq TO assetiq_user;


--
-- TOC entry 5406 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE lab_station_devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_station_devices TO assetiq_user;


--
-- TOC entry 5408 (class 0 OID 0)
-- Dependencies: 241
-- Name: SEQUENCE lab_station_devices_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_station_devices_id_seq TO assetiq_user;


--
-- TOC entry 5409 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE lab_stations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_stations TO assetiq_user;


--
-- TOC entry 5411 (class 0 OID 0)
-- Dependencies: 239
-- Name: SEQUENCE lab_stations_station_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_stations_station_id_seq TO assetiq_user;


--
-- TOC entry 5412 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE labs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.labs TO assetiq_user;


--
-- TOC entry 5414 (class 0 OID 0)
-- Dependencies: 225
-- Name: SEQUENCE labs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.labs_id_seq TO assetiq_user;


--
-- TOC entry 5415 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE password_reset_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.password_reset_tokens TO assetiq_user;


--
-- TOC entry 5417 (class 0 OID 0)
-- Dependencies: 221
-- Name: SEQUENCE password_reset_tokens_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.password_reset_tokens_id_seq TO assetiq_user;


--
-- TOC entry 5418 (class 0 OID 0)
-- Dependencies: 255
-- Name: TABLE scrap_register; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scrap_register TO assetiq_user;


--
-- TOC entry 5419 (class 0 OID 0)
-- Dependencies: 258
-- Name: TABLE scrap_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scrap_requests TO assetiq_user;


--
-- TOC entry 5421 (class 0 OID 0)
-- Dependencies: 259
-- Name: SEQUENCE scrap_requests_scrap_request_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.scrap_requests_scrap_request_id_seq TO assetiq_user;


--
-- TOC entry 5422 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE scrapped_devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scrapped_devices TO assetiq_user;


--
-- TOC entry 5424 (class 0 OID 0)
-- Dependencies: 257
-- Name: SEQUENCE scrapped_devices_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.scrapped_devices_id_seq TO assetiq_user;


--
-- TOC entry 5425 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE station_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.station_types TO assetiq_user;


--
-- TOC entry 5427 (class 0 OID 0)
-- Dependencies: 247
-- Name: SEQUENCE station_types_station_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.station_types_station_type_id_seq TO assetiq_user;


--
-- TOC entry 5428 (class 0 OID 0)
-- Dependencies: 265
-- Name: TABLE student_email_verification_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.student_email_verification_codes TO assetiq_user;


--
-- TOC entry 5430 (class 0 OID 0)
-- Dependencies: 264
-- Name: SEQUENCE student_email_verification_codes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.student_email_verification_codes_id_seq TO assetiq_user;


--
-- TOC entry 5431 (class 0 OID 0)
-- Dependencies: 261
-- Name: TABLE student_issue_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.student_issue_requests TO assetiq_user;


--
-- TOC entry 5433 (class 0 OID 0)
-- Dependencies: 260
-- Name: SEQUENCE student_issue_requests_request_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.student_issue_requests_request_id_seq TO assetiq_user;


--
-- TOC entry 5437 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE transfer_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.transfer_requests TO assetiq_user;


--
-- TOC entry 5439 (class 0 OID 0)
-- Dependencies: 245
-- Name: SEQUENCE transfer_requests_transfer_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.transfer_requests_transfer_id_seq TO assetiq_user;


--
-- TOC entry 5440 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE user_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_sessions TO assetiq_user;


--
-- TOC entry 5442 (class 0 OID 0)
-- Dependencies: 223
-- Name: SEQUENCE user_sessions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_sessions_id_seq TO assetiq_user;


--
-- TOC entry 5443 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO assetiq_user;


--
-- TOC entry 5445 (class 0 OID 0)
-- Dependencies: 219
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO assetiq_user;


--
-- TOC entry 2168 (class 826 OID 16452)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO assetiq_user;


--
-- TOC entry 2169 (class 826 OID 16451)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO assetiq_user;


-- Completed on 2026-06-03 16:50:17

--
-- PostgreSQL database dump complete
--

\unrestrict DXCMjmpKWLpEcP8OVYOO6HpMAglC3lotKyKX2eWoEgifSiqFgybI8k4EAulF2th

