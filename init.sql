
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    father_name VARCHAR(30) NOT NULL,
    dob DATE NOT NULL,
    email VARCHAR(100) NOT NULL,
    alt_email VARCHAR(100) NOT NULL,
    mobile VARCHAR(10) NOT NULL,
    alt_mobile VARCHAR(10) NOT NULL,
    aadhar VARCHAR(12) NOT NULL,
    pan VARCHAR(10) NOT NULL,
    permanent_street VARCHAR(30) NOT NULL,
    permanent_city VARCHAR(30) NOT NULL,
    permanent_state VARCHAR(30) NOT NULL,
    permanent_zipcode VARCHAR(6) NOT NULL,
    permanent_country VARCHAR(30) NOT NULL,
    current_street VARCHAR(30) NOT NULL,
    current_city VARCHAR(30) NOT NULL,
    current_state VARCHAR(30) NOT NULL,
    current_zipcode VARCHAR(6) NOT NULL,
    current_country VARCHAR(30) NOT NULL,
    account_holder_name VARCHAR(40) NOT NULL,
    bank_name VARCHAR(30) NOT NULL,
    account_number VARCHAR(16) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    bank_branch VARCHAR(30) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    department VARCHAR(50) DEFAULT 'Not Assigned',
    submission_date TIMESTAMP NOT NULL,
    CONSTRAINT unique_email UNIQUE (email),
    CONSTRAINT unique_aadhar UNIQUE (aadhar),
    CONSTRAINT unique_pan UNIQUE (pan),
    CONSTRAINT unique_account_number UNIQUE (account_number)
);


CREATE TABLE education (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    level VARCHAR(50) NOT NULL,
    stream VARCHAR(40) NOT NULL,
    institution VARCHAR(40) NOT NULL,
    board VARCHAR(50) NOT NULL,
    year_of_passing VARCHAR(4) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    CONSTRAINT unique_education_level UNIQUE (employee_id, level)
);


CREATE TABLE work_history (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    experience_type VARCHAR(20) NOT NULL,
    company_name VARCHAR(50),
    designation VARCHAR(50),
    employment_period INTEGER,
    location VARCHAR(50),
    reason_for_leaving VARCHAR(300),
    CONSTRAINT unique_work_entry UNIQUE (employee_id, company_name, designation, location)
);


CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    document_type VARCHAR(20) NOT NULL,
    file_name VARCHAR(100) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    file_data TEXT NOT NULL,
    education_id INTEGER REFERENCES education(id) ON DELETE SET NULL,
    work_history_id INTEGER REFERENCES work_history(id) ON DELETE SET NULL,
    CONSTRAINT check_document_type CHECK (document_type IN ('aadhar', 'pan', 'education', 'work'))
);
