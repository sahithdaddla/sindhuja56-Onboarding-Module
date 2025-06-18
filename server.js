const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// PostgreSQL connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'employee_onboardings',
    password: 'root',
    port: 5432,
});

// Multer setup for file handling (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit per file
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('File type not supported. Only PDF, JPG, JPEG, PNG allowed.'));
    },
});

// Helper function to convert file to base64
const fileToBase64 = (file) => {
    return {
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        data: file.buffer.toString('base64'),
    };
};

// Helper function to validate total file size
const validateTotalFileSize = (files) => {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 10 * 1024 * 1024) {
        throw new Error('Total size of uploaded files exceeds 10MB.');
    }
};

// API Endpoints

// Submit employee data
app.post('/api/employees', upload.fields([
    { name: 'aadharDocument', maxCount: 1 },
    { name: 'panDocument', maxCount: 1 },
    { name: 'educationCertificates', maxCount: 5 },
    { name: 'workDocuments', maxCount: 10 },
]), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            name, fatherName, dob, email, altEmail, mobile, altMobile, aadhar, pan,
            permanentStreet, permanentCity, permanentState, permanentZipcode, permanentCountry,
            currentStreet, currentCity, currentState, currentZipcode, currentCountry,
            education, workHistory, accountHolderName, bankName, accountNumber, ifscCode, bankBranch, accountType,
            status = 'pending', department = 'Not Assigned', submissionDate,
        } = req.body;

        // Parse JSON strings if sent as strings
        const parsedEducation = typeof education === 'string' ? JSON.parse(education) : education;
        const parsedWorkHistory = typeof workHistory === 'string' ? JSON.parse(workHistory) : workHistory;

        // Log request data for debugging
        console.log('Received workHistory:', JSON.stringify(parsedWorkHistory, null, 2));
        console.log('Received workDocuments:', req.files.workDocuments?.map(f => ({ name: f.originalname, size: f.size })));

        // Validate files
        const files = req.files;
        const aadharFile = files.aadharDocument ? fileToBase64(files.aadharDocument[0]) : null;
        const panFile = files.panDocument ? fileToBase64(files.panDocument[0]) : null;
        const educationFiles = files.educationCertificates ? files.educationCertificates.map(file => fileToBase64(file)) : [];
        const workFiles = files.workDocuments ? files.workDocuments.map(file => fileToBase64(file)) : [];

        validateTotalFileSize([
            ...(aadharFile ? [aadharFile] : []),
            ...(panFile ? [panFile] : []),
            ...educationFiles,
            ...workFiles,
        ]);

        // Insert employee
        const employeeResult = await client.query(
            `INSERT INTO employees (
                name, father_name, dob, email, alt_email, mobile, alt_mobile, aadhar, pan,
                permanent_street, permanent_city, permanent_state, permanent_zipcode, permanent_country,
                current_street, current_city, current_state, current_zipcode, current_country,
                account_holder_name, bank_name, account_number, ifsc_code, bank_branch, account_type,
                status, department, submission_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
            RETURNING id`,
            [
                name, fatherName, dob, email, altEmail, mobile, altMobile, aadhar, pan,
                permanentStreet, permanentCity, permanentState, permanentZipcode, permanentCountry,
                currentStreet, currentCity, currentState, currentZipcode, currentCountry,
                accountHolderName, bankName, accountNumber, ifscCode, bankBranch, accountType,
                status, department, submissionDate,
            ]
        );
        const employeeId = employeeResult.rows[0].id;

        // Insert documents
        if (aadharFile) {
            await client.query(
                `INSERT INTO documents (employee_id, document_type, file_name, file_type, file_size, file_data)
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [employeeId, 'aadhar', aadharFile.name, aadharFile.type, aadharFile.size, aadharFile.data]
            );
        }

        if (panFile) {
            await client.query(
                `INSERT INTO documents (employee_id, document_type, file_name, file_type, file_size, file_data)
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [employeeId, 'pan', panFile.name, panFile.type, panFile.size, panFile.data]
            );
        }

        // Insert education
        for (let i = 0; i < parsedEducation.length; i++) {
            const edu = parsedEducation[i];
            const certificate = educationFiles[i] || null;
            const educationResult = await client.query(
                `INSERT INTO education (
                    employee_id, level, stream, institution, board, year_of_passing, percentage
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [employeeId, edu.level, edu.stream, edu.institution, edu.board, edu.yearOfPassing, edu.percentage]
            );
            const educationId = educationResult.rows[0].id;

            if (certificate) {
                await client.query(
                    `INSERT INTO documents (employee_id, document_type, file_name, file_type, file_size, file_data, education_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [employeeId, 'education', certificate.name, certificate.type, certificate.size, certificate.data, educationId]
                );
            }
        }

        // Insert work history
        if (parsedWorkHistory && Array.isArray(parsedWorkHistory) && parsedWorkHistory.length > 0 && parsedWorkHistory[0]?.experienceType !== 'fresher') {
            let workDocIndex = 0;
            for (const work of parsedWorkHistory) {
                const workResult = await client.query(
                    `INSERT INTO work_history (
                        employee_id, experience_type, company_name, designation, employment_period, location, reason_for_leaving
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                    [
                        employeeId, 'experienced', work.companyName, work.designation,
                        work.employmentPeriod, work.location, work.reasonForLeaving,
                    ]
                );
                const workId = workResult.rows[0].id;

                // Validate work documents
                const workDocCount = Array.isArray(work.documents) ? work.documents.length : 0;
                if (workDocCount > 0) {
                    if (workDocIndex + workDocCount > workFiles.length) {
                        throw new Error(`Not enough work documents uploaded for ${work.companyName}. Expected ${workDocCount}, found ${workFiles.length - workDocIndex} remaining.`);
                    }
                    for (let i = 0; i < workDocCount; i++) {
                        const doc = workFiles[workDocIndex];
                        console.log('Inserting work document:', { employeeId, file_name: doc.name, work_history_id: workId });
                        await client.query(
                            `INSERT INTO documents (employee_id, document_type, file_name, file_type, file_size, file_data, work_history_id)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                            [employeeId, 'work', doc.name, doc.type, doc.size, doc.data, workId]
                        );
                        workDocIndex++;
                    }
                } else {
                    console.warn(`No documents provided for work history: ${work.companyName}`);
                }
            }
        } else {
            await client.query(
                `INSERT INTO work_history (employee_id, experience_type) VALUES ($1, $2)`,
                [employeeId, 'fresher']
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Employee data submitted successfully', employeeId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting employee data:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get all employees
app.get('/api/employees', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, email, status, submission_date
            FROM employees
            ORDER BY submission_date DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get employee details by ID
app.get('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch employee
        const employeeResult = await client.query(
            `SELECT * FROM employees WHERE id = $1`,
            [id]
        );
        if (employeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const employee = employeeResult.rows[0];

        // Fetch education
        const educationResult = await client.query(
            `SELECT id, level, stream, institution, board, year_of_passing, percentage
            FROM education WHERE employee_id = $1`,
            [id]
        );
        employee.education = educationResult.rows;

        // Fetch work history
        const workHistoryResult = await client.query(
            `SELECT id, experience_type, company_name, designation, employment_period, location, reason_for_leaving
            FROM work_history WHERE employee_id = $1`,
            [id]
        );
        employee.workHistory = workHistoryResult.rows;

        // Fetch documents
        const documentsResult = await client.query(
            `SELECT id, document_type, file_name, file_type, file_size, file_data, education_id, work_history_id
            FROM documents WHERE employee_id = $1`,
            [id]
        );

        // Log fetched documents
        console.log('Fetched documents:', documentsResult.rows.map(d => ({
            type: d.document_type,
            work_history_id: d.work_history_id,
            file_name: d.file_name
        })));

        // Structure documents
        employee.documents = { aadhar: null, pan: null, education: [], work: [] };
        for (const doc of documentsResult.rows) {
            const docData = {
                id: doc.id,
                name: doc.file_name,
                type: doc.file_type,
                size: doc.file_size,
                data: doc.file_data,
            };
            if (doc.document_type === 'aadhar') {
                employee.documents.aadhar = docData;
            } else if (doc.document_type === 'pan') {
                employee.documents.pan = docData;
            } else if (doc.document_type === 'education' && doc.education_id) {
                const eduIndex = employee.education.findIndex(edu => edu.id === doc.education_id);
                if (eduIndex !== -1) {
                    employee.education[eduIndex].certificate = docData;
                }
            } else if (doc.document_type === 'work' && doc.work_history_id) {
                const workIndex = employee.workHistory.findIndex(work => work.id === doc.work_history_id);
                if (workIndex !== -1) {
                    employee.workHistory[workIndex].documents = employee.workHistory[workIndex].documents || [];
                    employee.workHistory[workIndex].documents.push(docData);
                }
            }
        }

        await client.query('COMMIT');
        res.json(employee);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error fetching employee details:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Update employee status
app.patch('/api/employees/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE employees SET status = $1 WHERE id = $2 RETURNING id, status`,
            [status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete all employee records
app.delete('/api/employees', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM documents');
        await client.query('DELETE FROM education');
        await client.query('DELETE FROM work_history');
        await client.query('DELETE FROM employees');
        await client.query('COMMIT');
        res.json({ message: 'All employee records deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting records:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});