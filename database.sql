--
-- PostgreSQL database dump
--

\restrict Lf2fM5PsyEa48C1DKbEqXxeR6vKh4a79SHRguWhaMCj8iCTcEsh7gfLkcQHRvQD

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

-- Started on 2026-06-03 17:07:32

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
-- TOC entry 5327 (class 0 OID 0)
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
-- TOC entry 5330 (class 0 OID 0)
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
-- TOC entry 5333 (class 0 OID 0)
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
-- TOC entry 5336 (class 0 OID 0)
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
-- TOC entry 5339 (class 0 OID 0)
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
-- TOC entry 5342 (class 0 OID 0)
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
-- TOC entry 5345 (class 0 OID 0)
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
-- TOC entry 5348 (class 0 OID 0)
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
-- TOC entry 5351 (class 0 OID 0)
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
-- TOC entry 5354 (class 0 OID 0)
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
-- TOC entry 5357 (class 0 OID 0)
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
-- TOC entry 5360 (class 0 OID 0)
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
-- TOC entry 5363 (class 0 OID 0)
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
-- TOC entry 5366 (class 0 OID 0)
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
-- TOC entry 5369 (class 0 OID 0)
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
-- TOC entry 5373 (class 0 OID 0)
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
-- TOC entry 5376 (class 0 OID 0)
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
-- TOC entry 5379 (class 0 OID 0)
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
-- TOC entry 5382 (class 0 OID 0)
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
-- TOC entry 5385 (class 0 OID 0)
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
-- TOC entry 5387 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE transfer_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.transfer_requests IS 'Manages device transfer requests between labs with HOD approval workflow';


--
-- TOC entry 5388 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN transfer_requests.device_ids; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transfer_requests.device_ids IS 'JSON array of device IDs to be transferred';


--
-- TOC entry 5389 (class 0 OID 0)
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
-- TOC entry 5391 (class 0 OID 0)
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
-- TOC entry 5394 (class 0 OID 0)
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
-- TOC entry 5397 (class 0 OID 0)
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
-- TOC entry 5326 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE bills; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bills TO assetiq_user;


--
-- TOC entry 5328 (class 0 OID 0)
-- Dependencies: 229
-- Name: SEQUENCE bills_bill_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.bills_bill_id_seq TO assetiq_user;


--
-- TOC entry 5329 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE device_code_counters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.device_code_counters TO assetiq_user;


--
-- TOC entry 5331 (class 0 OID 0)
-- Dependencies: 253
-- Name: SEQUENCE device_code_counters_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.device_code_counters_id_seq TO assetiq_user;


--
-- TOC entry 5332 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE device_issue_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.device_issue_history TO assetiq_user;


--
-- TOC entry 5334 (class 0 OID 0)
-- Dependencies: 236
-- Name: SEQUENCE device_issue_history_history_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.device_issue_history_history_id_seq TO assetiq_user;


--
-- TOC entry 5335 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE device_issues; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.device_issues TO assetiq_user;


--
-- TOC entry 5337 (class 0 OID 0)
-- Dependencies: 234
-- Name: SEQUENCE device_issues_issue_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.device_issues_issue_id_seq TO assetiq_user;


--
-- TOC entry 5338 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.devices TO assetiq_user;


--
-- TOC entry 5340 (class 0 OID 0)
-- Dependencies: 231
-- Name: SEQUENCE devices_device_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.devices_device_id_seq TO assetiq_user;


--
-- TOC entry 5341 (class 0 OID 0)
-- Dependencies: 263
-- Name: TABLE email_verification_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_verification_codes TO assetiq_user;


--
-- TOC entry 5343 (class 0 OID 0)
-- Dependencies: 262
-- Name: SEQUENCE email_verification_codes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.email_verification_codes_id_seq TO assetiq_user;


--
-- TOC entry 5344 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE equipment_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.equipment_types TO assetiq_user;


--
-- TOC entry 5346 (class 0 OID 0)
-- Dependencies: 227
-- Name: SEQUENCE equipment_types_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.equipment_types_type_id_seq TO assetiq_user;


--
-- TOC entry 5347 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE lab_equipment_pool; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_equipment_pool TO assetiq_user;


--
-- TOC entry 5349 (class 0 OID 0)
-- Dependencies: 243
-- Name: SEQUENCE lab_equipment_pool_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_equipment_pool_id_seq TO assetiq_user;


--
-- TOC entry 5350 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE lab_grid_cells; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_grid_cells TO assetiq_user;


--
-- TOC entry 5352 (class 0 OID 0)
-- Dependencies: 238
-- Name: SEQUENCE lab_grid_cells_cell_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_grid_cells_cell_id_seq TO assetiq_user;


--
-- TOC entry 5353 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE lab_layout_cells; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_layout_cells TO assetiq_user;


--
-- TOC entry 5355 (class 0 OID 0)
-- Dependencies: 251
-- Name: SEQUENCE lab_layout_cells_cell_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_layout_cells_cell_id_seq TO assetiq_user;


--
-- TOC entry 5356 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE lab_layout_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_layout_templates TO assetiq_user;


--
-- TOC entry 5358 (class 0 OID 0)
-- Dependencies: 249
-- Name: SEQUENCE lab_layout_templates_layout_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_layout_templates_layout_id_seq TO assetiq_user;


--
-- TOC entry 5359 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE lab_station_devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_station_devices TO assetiq_user;


--
-- TOC entry 5361 (class 0 OID 0)
-- Dependencies: 241
-- Name: SEQUENCE lab_station_devices_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_station_devices_id_seq TO assetiq_user;


--
-- TOC entry 5362 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE lab_stations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lab_stations TO assetiq_user;


--
-- TOC entry 5364 (class 0 OID 0)
-- Dependencies: 239
-- Name: SEQUENCE lab_stations_station_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lab_stations_station_id_seq TO assetiq_user;


--
-- TOC entry 5365 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE labs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.labs TO assetiq_user;


--
-- TOC entry 5367 (class 0 OID 0)
-- Dependencies: 225
-- Name: SEQUENCE labs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.labs_id_seq TO assetiq_user;


--
-- TOC entry 5368 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE password_reset_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.password_reset_tokens TO assetiq_user;


--
-- TOC entry 5370 (class 0 OID 0)
-- Dependencies: 221
-- Name: SEQUENCE password_reset_tokens_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.password_reset_tokens_id_seq TO assetiq_user;


--
-- TOC entry 5371 (class 0 OID 0)
-- Dependencies: 255
-- Name: TABLE scrap_register; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scrap_register TO assetiq_user;


--
-- TOC entry 5372 (class 0 OID 0)
-- Dependencies: 258
-- Name: TABLE scrap_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scrap_requests TO assetiq_user;


--
-- TOC entry 5374 (class 0 OID 0)
-- Dependencies: 259
-- Name: SEQUENCE scrap_requests_scrap_request_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.scrap_requests_scrap_request_id_seq TO assetiq_user;


--
-- TOC entry 5375 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE scrapped_devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scrapped_devices TO assetiq_user;


--
-- TOC entry 5377 (class 0 OID 0)
-- Dependencies: 257
-- Name: SEQUENCE scrapped_devices_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.scrapped_devices_id_seq TO assetiq_user;


--
-- TOC entry 5378 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE station_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.station_types TO assetiq_user;


--
-- TOC entry 5380 (class 0 OID 0)
-- Dependencies: 247
-- Name: SEQUENCE station_types_station_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.station_types_station_type_id_seq TO assetiq_user;


--
-- TOC entry 5381 (class 0 OID 0)
-- Dependencies: 265
-- Name: TABLE student_email_verification_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.student_email_verification_codes TO assetiq_user;


--
-- TOC entry 5383 (class 0 OID 0)
-- Dependencies: 264
-- Name: SEQUENCE student_email_verification_codes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.student_email_verification_codes_id_seq TO assetiq_user;


--
-- TOC entry 5384 (class 0 OID 0)
-- Dependencies: 261
-- Name: TABLE student_issue_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.student_issue_requests TO assetiq_user;


--
-- TOC entry 5386 (class 0 OID 0)
-- Dependencies: 260
-- Name: SEQUENCE student_issue_requests_request_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.student_issue_requests_request_id_seq TO assetiq_user;


--
-- TOC entry 5390 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE transfer_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.transfer_requests TO assetiq_user;


--
-- TOC entry 5392 (class 0 OID 0)
-- Dependencies: 245
-- Name: SEQUENCE transfer_requests_transfer_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.transfer_requests_transfer_id_seq TO assetiq_user;


--
-- TOC entry 5393 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE user_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_sessions TO assetiq_user;


--
-- TOC entry 5395 (class 0 OID 0)
-- Dependencies: 223
-- Name: SEQUENCE user_sessions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_sessions_id_seq TO assetiq_user;


--
-- TOC entry 5396 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO assetiq_user;


--
-- TOC entry 5398 (class 0 OID 0)
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


-- Completed on 2026-06-03 17:07:32

--
-- PostgreSQL database dump complete
--

\unrestrict Lf2fM5PsyEa48C1DKbEqXxeR6vKh4a79SHRguWhaMCj8iCTcEsh7gfLkcQHRvQD

