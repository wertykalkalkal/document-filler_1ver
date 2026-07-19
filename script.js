// Глобальные переменные
let extractedData = {};
let selectedTemplate = '';
let generatedDocument = null;

// Полный список полей для анкеты
const FORM_FIELDS = {
    // Персональные данные
    lastName: { label: 'Фамилия', required: true, type: 'text' },
    firstName: { label: 'Имя', required: true, type: 'text' },
    middleName: { label: 'Отчество', required: false, type: 'text' },
    birthDate: { label: 'Дата рождения', required: true, type: 'date' },
    birthPlace: { label: 'Место рождения', required: true, type: 'text' },
    
    // Паспортные данные
    passportSeries: { label: 'Серия паспорта', required: true, type: 'text' },
    passportNumber: { label: 'Номер паспорта', required: true, type: 'text' },
    passportDate: { label: 'Дата выдачи паспорта', required: true, type: 'date' },
    passportIssuer: { label: 'Кем выдан паспорт', required: true, type: 'text' },
    passportCode: { label: 'Код подразделения', required: true, type: 'text' },
    
    // Контактная информация
    phone: { label: 'Телефон', required: true, type: 'tel' },
    email: { label: 'Email', required: false, type: 'email' },
    
    // Адрес
    registrationAddress: { label: 'Адрес регистрации', required: true, type: 'text' },
    actualAddress: { label: 'Адрес фактического проживания', required: false, type: 'text' },
    
    // Дополнительная информация
    inn: { label: 'ИНН', required: false, type: 'text' },
    snils: { label: 'СНИЛС', required: false, type: 'text' },
    education: { label: 'Образование', required: false, type: 'text' },
    maritalStatus: { label: 'Семейное положение', required: false, type: 'text' },
    citizenship: { label: 'Гражданство', required: true, type: 'text' },
    
    // Трудовая деятельность
    workplace: { label: 'Место работы', required: false, type: 'text' },
    position: { label: 'Должность', required: false, type: 'text' },
    workExperience: { label: 'Стаж работы', required: false, type: 'text' },
    monthlyIncome: { label: 'Ежемесячный доход', required: false, type: 'number' }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeUpload();
    initializeTemplates();
    initializeButtons();
});

// === ЗАГРУЗКА И ОБРАБОТКА PDF ===
function initializeUpload() {
    const uploadArea = document.getElementById('pdfUploadArea');
    const fileInput = document.getElementById('pdfFile');

    // Клик по области загрузки
    uploadArea.addEventListener('click', () => fileInput.click());

    // Обработка выбора файла
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Drag & Drop
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            handleFile(files[0]);
        } else {
            showStatus('Пожалуйста, загрузите PDF файл', 'error');
        }
    });
}

// Обработка загруженного файла
function handleFile(file) {
    showStatus('Обрабатываем документ...', 'loading');

    const reader = new FileReader();
    reader.onload = function(e) {
        const typedArray = new Uint8Array(e.target.result);
        
        pdfjsLib.getDocument(typedArray).promise.then(function(pdf) {
            extractTextFromPDF(pdf).then(function(text) {
                extractedData = parseAllFields(text);
                showStatus('Документ успешно обработан', 'success');
                if (selectedTemplate) {
                    showDataForm();
                }
            });
        }).catch(function(error) {
            showStatus('Ошибка при чтении PDF: ' + error.message, 'error');
        });
    };
    
    reader.readAsArrayBuffer(file);
}

// Извлечение текста из PDF
async function extractTextFromPDF(pdf) {
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
    }
    
    return fullText;
}

// Расширенный парсинг всех полей
function parseAllFields(text) {
    const data = {};
    const cleanText = text.replace(/\s+/g, ' ').trim();

    // ФИО (попытка найти полное ФИО)
    const fullNameMatch = cleanText.match(/([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/);
    if (fullNameMatch) {
        const nameParts = fullNameMatch[1].split(' ');
        data.lastName = nameParts[0];
        data.firstName = nameParts[1];
        data.middleName = nameParts[2] || '';
    }

    // Даты рождения
    const birthDatePatterns = [
        /дата\s+рождения[:\s]*(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/i,
        /родился[:\s]*(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/i,
        /родилась[:\s]*(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/i
    ];
    
    for (const pattern of birthDatePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            data.birthDate = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
            break;
        }
    }

    // Место рождения
    const birthPlaceMatch = cleanText.match(/место\s+рождения[:\s]*([^,\n\r]+)/i);
    if (birthPlaceMatch) {
        data.birthPlace = birthPlaceMatch[1].trim();
    }

    // Паспортные данные
    const passportMatch = cleanText.match(/(\d{4})\s*(\d{6})/);
    if (passportMatch) {
        data.passportSeries = passportMatch[1];
        data.passportNumber = passportMatch[2];
    }

    // Дата выдачи паспорта
    const passportDateMatch = cleanText.match(/выдан[:\s]*(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/i);
    if (passportDateMatch) {
        data.passportDate = `${passportDateMatch[3]}-${passportDateMatch[2].padStart(2, '0')}-${passportDateMatch[1].padStart(2, '0')}`;
    }

    // Кем выдан паспорт
    const issuerMatch = cleanText.match(/выдан[:\s]*([^,\n\r]+?)(?:\s+(\d{3}-\d{3}))?/i);
    if (issuerMatch) {
        data.passportIssuer = issuerMatch[1].trim();
        if (issuerMatch[2]) {
            data.passportCode = issuerMatch[2];
        }
    }

    // Код подразделения
    const codeMatch = cleanText.match(/код\s+подразделения[:\s]*(\d{3}-\d{3})/i);
    if (codeMatch) {
        data.passportCode = codeMatch[1];
    }

    // Телефон
    const phonePatterns = [
        /тел[:\s]*[\+]?[78]?[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/i,
        /моб[:\s]*[\+]?[78]?[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/i,
        /[\+]?[78][\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/
    ];
    
    for (const pattern of phonePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            data.phone = `+7${match[1]}${match[2]}${match[3]}${match[4]}`;
            break;
        }
    }

    // Email
    const emailMatch = cleanText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
        data.email = emailMatch[1];
    }

    // Адрес регистрации
    const addressPatterns = [
        /адрес\s+регистрации[:\s]*([^,\n\r]+)/i,
        /прописан[:\s]*([^,\n\r]+)/i,
        /зарегистрирован[:\s]*([^,\n\r]+)/i
    ];
    
    for (const pattern of addressPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            data.registrationAddress = match[1].trim();
            break;
        }
    }

    // ИНН
    const innMatch = cleanText.match(/инн[:\s]*(\d{10,12})/i);
    if (innMatch) {
        data.inn = innMatch[1];
    }

    // СНИЛС
    const snilsMatch = cleanText.match(/снилс[:\s]*(\d{3}-\d{3}-\d{3}\s\d{2})/i);
    if (snilsMatch) {
        data.snils = snilsMatch[1];
    }

    // Гражданство (по умолчанию РФ)
    const citizenshipMatch = cleanText.match(/гражданство[:\s]*([^,\n\r]+)/i);
    if (citizenshipMatch) {
        data.citizenship = citizenshipMatch[1].trim();
    } else {
        data.citizenship = 'Российская Федерация';
    }

    return data;
}

// Отображение статуса
function showStatus(message, type) {
    const status = document.getElementById('pdfStatus');
    status.textContent = message;
    status.className = `status ${type}`;
}

// === ШАБЛОНЫ ===
function initializeTemplates() {
    const templateButtons = document.querySelectorAll('.template-btn');
    
    templateButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Убираем выделение с других кнопок
            templateButtons.forEach(b => b.classList.remove('selected'));
            // Выделяем текущую
            this.classList.add('selected');
            
            selectedTemplate = this.dataset.template;
            
            // Показываем форму если PDF загружен
            if (Object.keys(extractedData).length > 0) {
                showDataForm();
            }
        });
    });
}

// Показать форму с данными
function showDataForm() {
    const preview = document.getElementById('dataPreview');
    const formContainer = document.getElementById('dataForm');
    
    let html = '';
    
    // Создаем поля для ввода на основе найденных и недостающих данных
    for (const [fieldName, fieldConfig] of Object.entries(FORM_FIELDS)) {
        const value = extractedData[fieldName] || '';
        const isEmpty = !value;
        const inputClass = isEmpty ? 'field-input empty' : 'field-input';
        const placeholder = isEmpty ? 'Заполните вручную' : '';
        const hint = isEmpty && fieldConfig.required ? 'Поле обязательно для заполнения' : '';
        
        html += `
            <div class="field-group">
                <label class="field-label" for="${fieldName}">
                    ${fieldConfig.label}
                    ${fieldConfig.required ? '*' : ''}
                </label>
                <input 
                    type="${fieldConfig.type}" 
                    id="${fieldName}" 
                    name="${fieldName}"
                    class="${inputClass}"
                    value="${value}"
                    placeholder="${placeholder}"
                    ${fieldConfig.required ? 'required' : ''}
                >
                ${hint ? `<span class="field-hint">${hint}</span>` : ''}
            </div>
        `;
    }
    
    formContainer.innerHTML = html;
    preview.style.display = 'block';
    
    // Добавляем обработчики для полей
    const inputs = formContainer.querySelectorAll('.field-input');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            if (this.value.trim()) {
                this.classList.remove('empty');
            } else {
                this.classList.add('empty');
            }
        });
    });
}

// === ГЕНЕРАЦИЯ ДОКУМЕНТА ===
function initializeButtons() {
    const fillBtn = document.getElementById('fillDocument');
    const downloadBtn = document.getElementById('downloadBtn');

    fillBtn.addEventListener('click', generateDocument);
    downloadBtn.addEventListener('click', downloadDocument);
}

// Сбор данных из формы
function collectFormData() {
    const formData = {};
    const form = document.getElementById('dataForm');
    const inputs = form.querySelectorAll('input');
    
    inputs.forEach(input => {
        formData[input.name] = input.value.trim();
    });
    
    return formData;
}

// Генерация документа
function generateDocument() {
    const formData = collectFormData();
    
    // Проверяем обязательные поля
    const missingRequired = [];
    for (const [fieldName, fieldConfig] of Object.entries(FORM_FIELDS)) {
        if (fieldConfig.required && !formData[fieldName]) {
            missingRequired.push(fieldConfig.label);
        }
    }
    
    if (missingRequired.length > 0) {
        alert(`Заполните обязательные поля:\n${missingRequired.join('\n')}`);
        return;
    }

    const templates = {
        application: generateApplication,
        questionnaire: generateQuestionnaire,
        agreement: generateAgreement
    };

    const generator = templates[selectedTemplate];
    if (generator) {
        generatedDocument = generator(formData);
        showResult();
    }
}

// Шаблон заявления (обновленный)
function generateApplication(data) {
    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: [
                new docx.Paragraph({
                    text: "В ПАО \"Промсвязьбанк\"",
                    alignment: docx.AlignmentType.RIGHT,
                }),
                new docx.Paragraph({
                    text: `от ${data.lastName} ${data.firstName} ${data.middleName}`,
                    alignment: docx.AlignmentType.RIGHT,
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: "ЗАЯВЛЕНИЕ",
                    heading: docx.HeadingLevel.HEADING_1,
                    alignment: docx.AlignmentType.CENTER,
                }),
                new docx.Paragraph({
                    text: "на заключение договора банковского обслуживания",
                    alignment: docx.AlignmentType.CENTER,
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: `Прошу заключить со мной договор банковского обслуживания.`,
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: "Персональные данные:",
                    bold: true,
                }),
                new docx.Paragraph({
                    text: `ФИО: ${data.lastName} ${data.firstName} ${data.middleName}`,
                }),
                new docx.Paragraph({
                    text: `Дата рождения: ${formatDate(data.birthDate)}`,
                }),
                new docx.Paragraph({
                    text: `Паспорт: ${data.passportSeries} ${data.passportNumber}`,
                }),
                new docx.Paragraph({
                    text: `Телефон: ${data.phone}`,
                }),
                new docx.Paragraph({
                    text: `Email: ${data.email || 'не указан'}`,
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: `Дата: ${new Date().toLocaleDateString('ru-RU')}`,
                }),
                new docx.Paragraph({
                    text: "Подпись: ________________",
                }),
            ],
        }],
    });

    return doc;
}

// Полная анкета клиента
function generateQuestionnaire(data) {
    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: [
                new docx.Paragraph({
                    text: "АНКЕТА КЛИЕНТА - ФИЗИЧЕСКОГО ЛИЦА",
                    heading: docx.HeadingLevel.HEADING_1,
                    alignment: docx.AlignmentType.CENTER,
                }),
                new docx.Paragraph({
                    text: "ПАО \"Промсвязьбанк\"",
                    alignment: docx.AlignmentType.CENTER,
                }),
                new docx.Paragraph({ text: "" }),
                
                // Персональные данные
                new docx.Paragraph({
                    text: "1. ПЕРСОНАЛЬНЫЕ ДАННЫЕ",
                    bold: true,
                }),
                new docx.Paragraph({
                    text: `Фамилия: ${data.lastName || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Имя: ${data.firstName || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Отчество: ${data.middleName || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Дата рождения: ${formatDate(data.birthDate) || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Место рождения: ${data.birthPlace || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Гражданство: ${data.citizenship || '________________________________'}`,
                }),
                new docx.Paragraph({ text: "" }),
                
                // Паспортные данные
                new docx.Paragraph({
                    text: "2. ПАСПОРТНЫЕ ДАННЫЕ",
                    bold: true,
                }),
                new docx.Paragraph({
                    text: `Серия: ${data.passportSeries || '________'} Номер: ${data.passportNumber || '______________'}`,
                }),
                new docx.Paragraph({
                    text: `Дата выдачи: ${formatDate(data.passportDate) || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Кем выдан: ${data.passportIssuer || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Код подразделения: ${data.passportCode || '________'}`,
                }),
                new docx.Paragraph({ text: "" }),
                
                // Контактная информация
                new docx.Paragraph({
                    text: "3. КОНТАКТНАЯ ИНФОРМАЦИЯ",
                    bold: true,
                }),
                new docx.Paragraph({
                    text: `Телефон: ${data.phone || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Email: ${data.email || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Адрес регистрации: ${data.registrationAddress || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Адрес фактического проживания: ${data.actualAddress || '________________________________'}`,
                }),
                new docx.Paragraph({ text: "" }),
                
                // Дополнительные данные
                new docx.Paragraph({
                    text: "4. ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ",
                    bold: true,
                }),
                new docx.Paragraph({
                    text: `ИНН: ${data.inn || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `СНИЛС: ${data.snils || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Семейное положение: ${data.maritalStatus || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Образование: ${data.education || '________________________________'}`,
                }),
                new docx.Paragraph({ text: "" }),
                
                // Трудовая деятельность
                new docx.Paragraph({
                    text: "5. ТРУДОВАЯ ДЕЯТЕЛЬНОСТЬ",
                    bold: true,
                }),
                new docx.Paragraph({
                    text: `Место работы: ${data.workplace || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Должность: ${data.position || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Стаж работы: ${data.workExperience || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Ежемесячный доход: ${data.monthlyIncome || '________________________________'} руб.`,
                }),
                new docx.Paragraph({ text: "" }),
                
                // Подпись
                new docx.Paragraph({
                    text: `Дата заполнения: ${new Date().toLocaleDateString('ru-RU')}`,
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: "Клиент: ________________ /_____________________/",
                }),
                new docx.Paragraph({
                    text: "         (подпись)              (расшифровка подписи)",
                }),
            ],
        }],
    });

    return doc;
}

// Договор обслуживания
function generateAgreement(data) {
    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: [
                new docx.Paragraph({
                    text: "ДОГОВОР БАНКОВСКОГО ОБСЛУЖИВАНИЯ",
                    heading: docx.HeadingLevel.HEADING_1,
                    alignment: docx.AlignmentType.CENTER,
                }),
                new docx.Paragraph({
                    text: `г. Москва                                     ${new Date().toLocaleDateString('ru-RU')}`,
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: `ПАО \"Промсвязьбанк\", именуемый в дальнейшем \"Банк\", с одной стороны, и ${data.lastName} ${data.firstName} ${data.middleName}, именуемый в дальнейшем \"Клиент\", с другой стороны, заключили настоящий Договор о нижеследующем:`,
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: "1. ДАННЫЕ КЛИЕНТА",
                    bold: true,
                }),
                new docx.Paragraph({
                    text: `ФИО: ${data.lastName} ${data.firstName} ${data.middleName}`,
                }),
                new docx.Paragraph({
                    text: `Дата рождения: ${formatDate(data.birthDate)}`,
                }),
                new docx.Paragraph({
                    text: `Паспорт: серия ${data.passportSeries} номер ${data.passportNumber}`,
                }),
                new docx.Paragraph({
                    text: `Выдан: ${formatDate(data.passportDate)} ${data.passportIssuer}`,
                }),
                new docx.Paragraph({
                    text: `Адрес регистрации: ${data.registrationAddress}`,
                }),
                new docx.Paragraph({
                    text: `Телефон: ${data.phone}`,
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: "2. УСЛОВИЯ ДОГОВОРА",
                    bold: true,
                }),
                new docx.Paragraph({
                    text: "2.1. Банк обязуется предоставить Клиенту банковские услуги в соответствии с тарифами Банка.",
                }),
                new docx.Paragraph({
                    text: "2.2. Клиент обязуется соблюдать требования законодательства и внутренних документов Банка.",
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: "3. ПОДПИСИ СТОРОН",
                    bold: true,
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: "БАНК:                           КЛИЕНТ:",
                }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({
                    text: "_________________         _________________",
                }),
            ],
        }],
    });

    return doc;
}

// Вспомогательная функция форматирования дат
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

// Показать результат
function showResult() {
    const resultDiv = document.getElementById('result');
    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

// Скачивание документа
function downloadDocument() {
    if (!generatedDocument) {
        alert('Документ не сгенерирован');
        return;
    }

    const templateNames = {
        application: 'Заявление',
        questionnaire: 'Анкета',
        agreement: 'Договор'
    };

    docx.Packer.toBlob(generatedDocument).then(function(blob) {
        const fileName = `${templateNames[selectedTemplate]}_${new Date().getTime()}.docx`;
        saveAs(blob, fileName);
    });
}
