// Глобальные переменные
let extractedData = {};
let generatedDocument = null;
let userEmail = '';

// Поля для анкеты юридического лица
const COMPANY_FIELDS = {
    // Основная информация
    fullName: { label: 'Полное наименование организации', required: true, type: 'text' },
    shortName: { label: 'Сокращенное наименование', required: false, type: 'text' },
    inn: { label: 'ИНН', required: true, type: 'text' },
    kpp: { label: 'КПП', required: true, type: 'text' },
    ogrn: { label: 'ОГРН', required: true, type: 'text' },
    okpo: { label: 'ОКПО', required: false, type: 'text' },
    okved: { label: 'ОКВЭД (основной)', required: false, type: 'text' },
    
    // Адреса
    legalAddress: { label: 'Юридический адрес', required: true, type: 'text' },
    actualAddress: { label: 'Фактический адрес', required: false, type: 'text' },
    mailingAddress: { label: 'Почтовый адрес', required: false, type: 'text' },
    
    // Контактная информация
    phone: { label: 'Телефон', required: true, type: 'tel' },
    fax: { label: 'Факс', required: false, type: 'tel' },
    email: { label: 'Email', required: false, type: 'email' },
    website: { label: 'Веб-сайт', required: false, type: 'url' },
    
    // Руководство
    directorPosition: { label: 'Должность руководителя', required: true, type: 'text' },
    directorName: { label: 'ФИО руководителя', required: true, type: 'text' },
    directorDocument: { label: 'Документ-основание полномочий руководителя', required: false, type: 'text' },
    
    // Главный бухгалтер
    accountantName: { label: 'ФИО главного бухгалтера', required: false, type: 'text' },
    
    // Регистрационные данные
    registrationDate: { label: 'Дата государственной регистрации', required: false, type: 'date' },
    registrationAuthority: { label: 'Орган, осуществивший регистрацию', required: false, type: 'text' },
    
    // Финансовая информация
    authorizedCapital: { label: 'Уставный капитал (руб.)', required: false, type: 'number' },
    employeesCount: { label: 'Количество сотрудников', required: false, type: 'number' },
    
    // Банковские реквизиты (если есть)
    bankName: { label: 'Наименование банка', required: false, type: 'text' },
    currentAccount: { label: 'Расчетный счет', required: false, type: 'text' },
    correspondentAccount: { label: 'Корреспондентский счет', required: false, type: 'text' },
    bik: { label: 'БИК банка', required: false, type: 'text' }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    updateBankName();
    initializeUpload();
    initializeButtons();
});

// Обновляем название банка
function updateBankName() {
    // Обновляем заголовок
    const header = document.querySelector('.logo-section h1');
    if (header) {
        header.textContent = 'Банк Полёт!';
    }
    
    // Обновляем подзаголовок
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        subtitle.textContent = 'Система заполнения анкет юридических лиц';
    }
    
    // Убираем выбор шаблонов, так как у нас только анкета
    const templateSection = document.querySelector('.step:nth-child(2)');
    if (templateSection) {
        templateSection.style.display = 'none';
    }
}

// === ЗАГРУЗКА И ОБРАБОТКА PDF ===
function initializeUpload() {
    const uploadArea = document.getElementById('pdfUploadArea');
    const fileInput = document.getElementById('pdfFile');

    // Обновляем текст загрузки
    const uploadText = uploadArea.querySelector('p');
    if (uploadText) {
        uploadText.textContent = 'Выберите PDF с карточкой компании';
    }

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
            showStatus('Пожалуйста, загрузите PDF файл с карточкой компании', 'error');
        }
    });
}

// Обработка загруженного файла
function handleFile(file) {
    showStatus('Обрабатываем карточку компании...', 'loading');

    const reader = new FileReader();
    reader.onload = function(e) {
        const typedArray = new Uint8Array(e.target.result);
        
        pdfjsLib.getDocument(typedArray).promise.then(function(pdf) {
            extractTextFromPDF(pdf).then(function(text) {
                extractedData = parseCompanyData(text);
                showStatus('Данные компании успешно извлечены', 'success');
                showDataForm();
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

// Парсинг данных компании из текста
function parseCompanyData(text) {
    const data = {};
    const cleanText = text.replace(/\s+/g, ' ').trim();

    // ИНН (основной критерий)
    const innPatterns = [
        /ИНН[:\s]*(\d{10})/i,
        /инн[:\s]*(\d{10})/i,
        /(\d{10})/g
    ];
    
    for (const pattern of innPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            // Проверяем, что это действительно ИНН (10 цифр для юр.лица)
            const inn = match[1] || match[0];
            if (inn && inn.length === 10 && /^\d{10}$/.test(inn)) {
                data.inn = inn;
                break;
            }
        }
    }

    // КПП
    const kppPatterns = [
        /КПП[:\s]*(\d{9})/i,
        /кпп[:\s]*(\d{9})/i
    ];
    
    for (const pattern of kppPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1].length === 9) {
            data.kpp = match[1];
            break;
        }
    }

    // ОГРН
    const ogrnPatterns = [
        /ОГРН[:\s]*(\d{13})/i,
        /огрн[:\s]*(\d{13})/i
    ];
    
    for (const pattern of ogrnPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1].length === 13) {
            data.ogrn = match[1];
            break;
        }
    }

    // Наименование организации
    const namePatterns = [
        /(?:ООО|ЗАО|ОАО|АО|ПАО)\s+"?([^"]+)"?/i,
        /([А-ЯЁ][А-ЯЁ\s]+(?:ООО|ЗАО|ОАО|АО|ПАО))/i,
        /наименование[:\s]*([^,\n\r]+)/i,
        /организация[:\s]*([^,\n\r]+)/i
    ];
    
    for (const pattern of namePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            data.fullName = match[1].trim().replace(/"/g, '');
            // Попытаемся создать сокращенное наименование
            if (data.fullName.includes('ООО')) {
                data.shortName = data.fullName.replace(/общество с ограниченной ответственностью/i, 'ООО');
            } else if (data.fullName.includes('АО')) {
                data.shortName = data.fullName.replace(/акционерное общество/i, 'АО');
            }
            break;
        }
    }

    // Адрес
    const addressPatterns = [
        /(?:юридический\s+)?адрес[:\s]*([^,\n\r]+(?:\d{6})?[^,\n\r]*)/i,
        /(?:место\s+нахождения)[:\s]*([^,\n\r]+)/i,
        /адрес[:\s]*([^,\n\r]+)/i
    ];
    
    for (const pattern of addressPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            data.legalAddress = match[1].trim();
            break;
        }
    }

    // Телефон
    const phonePatterns = [
        /тел[:\s]*[\+]?[78]?[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/i,
        /телефон[:\s]*[\+]?[78]?[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/i,
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

    // Руководитель
    const directorPatterns = [
        /(?:генеральный\s+)?директор[:\s]*([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/i,
        /руководитель[:\s]*([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/i
    ];
    
    for (const pattern of directorPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            data.directorName = match[1].trim();
            data.directorPosition = 'Генеральный директор';
            break;
        }
    }

    // ОКПО
    const okpoMatch = cleanText.match(/ОКПО[:\s]*(\d{8,10})/i);
    if (okpoMatch) {
        data.okpo = okpoMatch[1];
    }

    // ОКВЭД
    const okvedMatch = cleanText.match(/ОКВЭД[:\s]*(\d{2}\.\d{2}(?:\.\d{1,2})?)/i);
    if (okvedMatch) {
        data.okved = okvedMatch[1];
    }

    // Уставный капитал
    const capitalPatterns = [
        /уставный\s+капитал[:\s]*(\d+(?:\s\d+)*)/i,
        /уставной\s+капитал[:\s]*(\d+(?:\s\d+)*)/i
    ];
    
    for (const pattern of capitalPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            data.authorizedCapital = match[1].replace(/\s/g, '');
            break;
        }
    }

    // Дата регистрации
    const regDatePatterns = [
        /дата\s+регистрации[:\s]*(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/i,
        /зарегистрирован[:\s]*(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/i
    ];
    
    for (const pattern of regDatePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            data.registrationDate = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
            break;
        }
    }

    return data;
}

// Отображение статуса
function showStatus(message, type) {
    const status = document.getElementById('pdfStatus');
    status.textContent = message;
    status.className = `status ${type}`;
}

// Показать форму с данными компании
function showDataForm() {
    const preview = document.getElementById('dataPreview');
    const dataContainer = document.getElementById('dataForm');
    
    // Обновляем заголовок секции
    const sectionTitle = preview.querySelector('h2');
    if (sectionTitle) {
        sectionTitle.textContent = '2. Проверьте и дополните данные компании';
    }
    
    let html = '';
    
    // Создаем поля для ввода
    for (const [fieldName, fieldConfig] of Object.entries(COMPANY_FIELDS)) {
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

    // Добавляем поле для email пользователя
    html += `
        <div class="field-group email-section">
            <label class="field-label" for="userEmail">
                Ваш email для отправки анкеты*
            </label>
            <input 
                type="email" 
                id="userEmail" 
                name="userEmail"
                class="field-input"
                placeholder="example@company.com"
                required
            >
            <span class="field-hint">Заполненная анкета будет отправлена на этот адрес</span>
        </div>
    `;
    
    dataContainer.innerHTML = html;
    preview.style.display = 'block';
    
    // Добавляем обработчики для полей
    const inputs = dataContainer.querySelectorAll('.field-input');
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

    // Обновляем текст кнопки
    if (fillBtn) {
        fillBtn.textContent = 'Сформировать анкету';
    }

    if (downloadBtn) {
        downloadBtn.textContent = 'Скачать анкету';
    }

    fillBtn.addEventListener('click', generateDocument);
    downloadBtn.addEventListener('click', downloadDocument);
}

// Сбор данных из формы
function collectFormData() {
    const formData = {};
    const form = document.getElementById('dataForm');
    const inputs = form.querySelectorAll('input');
    
    inputs.forEach(input => {
        if (input.name === 'userEmail') {
            userEmail = input.value.trim();
        } else {
            formData[input.name] = input.value.trim();
        }
    });
    
    return formData;
}

// Генерация анкеты
function generateDocument() {
    const formData = collectFormData();
    
    // Проверяем email пользователя
    if (!userEmail || !validateEmail(userEmail)) {
        alert('Укажите корректный email для отправки анкеты');
        return;
    }
    
    // Проверяем обязательные поля
    const missingRequired = [];
    for (const [fieldName, fieldConfig] of Object.entries(COMPANY_FIELDS)) {
        if (fieldConfig.required && !formData[fieldName]) {
            missingRequired.push(fieldConfig.label);
        }
    }
    
    if (missingRequired.length > 0) {
        alert(`Заполните обязательные поля:\n${missingRequired.join('\n')}`);
        return;
    }

    generatedDocument = generateCompanyQuestionnaire(formData);
    showResult();
}

// Генерация анкеты юридического лица
function generateCompanyQuestionnaire(data) {
    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: [
                new docx.Paragraph({
                    text: "АНКЕТА ЮРИДИЧЕСКОГО ЛИЦА",
                    heading: docx.HeadingLevel.HEADING_1,
                    alignment: docx.AlignmentType.CENTER,
                }),
                new docx.Paragraph({
                    text: 'ОАО "Банк Полёт!"',
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),
                
                // Основная информация
                new docx.Paragraph({
                    text: "1. ОСНОВНАЯ ИНФОРМАЦИЯ",
                    bold: true,
                    spacing: { before: 200, after: 200 }
                }),
                new docx.Paragraph({
                    text: `Полное наименование: ${data.fullName || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Сокращенное наименование: ${data.shortName || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `ИНН: ${data.inn || '__________________'}`,
                }),
                new docx.Paragraph({
                    text: `КПП: ${data.kpp || '__________________'}`,
                }),
                new docx.Paragraph({
                    text: `ОГРН: ${data.ogrn || '__________________'}`,
                }),
                new docx.Paragraph({
                    text: `ОКПО: ${data.okpo || '__________________'}`,
                }),
                new docx.Paragraph({
                    text: `ОКВЭД: ${data.okved || '__________________'}`,
                }),
                
                // Адреса
                new docx.Paragraph({
                    text: "2. АДРЕСА",
                    bold: true,
                    spacing: { before: 300, after: 200 }
                }),
                new docx.Paragraph({
                    text: `Юридический адрес: ${data.legalAddress || '________________________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Фактический адрес: ${data.actualAddress || '________________________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Почтовый адрес: ${data.mailingAddress || '________________________________________________'}`,
                }),
                
                // Контактная информация
                new docx.Paragraph({
                    text: "3. КОНТАКТНАЯ ИНФОРМАЦИЯ",
                    bold: true,
                    spacing: { before: 300, after: 200 }
                }),
                new docx.Paragraph({
                    text: `Телефон: ${data.phone || '__________________'}`,
                }),
                new docx.Paragraph({
                    text: `Факс: ${data.fax || '__________________'}`,
                }),
                new docx.Paragraph({
                    text: `Email: ${data.email || '__________________'}`,
                }),
                new docx.Paragraph({
                    text: `Веб-сайт: ${data.website || '__________________'}`,
                }),
                
                // Руководство
                new docx.Paragraph({
                    text: "4. РУКОВОДСТВО",
                    bold: true,
                    spacing: { before: 300, after: 200 }
                }),
                new docx.Paragraph({
                    text: `Должность руководителя: ${data.directorPosition || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `ФИО руководителя: ${data.directorName || '________________________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Документ-основание полномочий: ${data.directorDocument || '________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Главный бухгалтер: ${data.accountantName || '________________________________________________'}`,
                }),
                
                // Регистрационные данные
                new docx.Paragraph({
                    text: "5. РЕГИСТРАЦИОННЫЕ ДАННЫЕ",
                    bold: true,
                    spacing: { before: 300, after: 200 }
                }),
                new docx.Paragraph({
                    text: `Дата государственной регистрации: ${formatDate(data.registrationDate) || '______________'}`,
                }),
                new docx.Paragraph({
                    text: `Орган регистрации: ${data.registrationAuthority || '________________________________________________'}`,
                }),
                
                // Финансовая информация
                new docx.Paragraph({
                    text: "6. ФИНАНСОВАЯ ИНФОРМАЦИЯ",
                    bold: true,
                    spacing: { before: 300, after: 200 }
                }),
                new docx.Paragraph({
                    text: `Уставный капитал: ${data.authorizedCapital || '__________________'} руб.`,
                }),
                new docx.Paragraph({
                    text: `Количество сотрудников: ${data.employeesCount || '__________________'} чел.`,
                }),
                
                // Банковские реквизиты
                new docx.Paragraph({
                    text: "7. БАНКОВСКИЕ РЕКВИЗИТЫ",
                    bold: true,
                    spacing: { before: 300, after: 200 }
                }),
                new docx.Paragraph({
                    text: `Наименование банка: ${data.bankName || '________________________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Расчетный счет: ${data.currentAccount || '__________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `Корреспондентский счет: ${data.correspondentAccount || '__________________________________'}`,
                }),
                new docx.Paragraph({
                    text: `БИК: ${data.bik || '__________________'}`,
                }),
                
                // Подпись
                new docx.Paragraph({
                    text: "",
                    spacing: { before: 400 }
                }),
                new docx.Paragraph({
                    text: `Дата заполнения: ${new Date().toLocaleDateString('ru-RU')}`,
                }),
                new docx.Paragraph({
                    text: "",
                    spacing: { before: 200 }
                }),
                new docx.Paragraph({
                    text: "Руководитель: ________________ /_____________________/",
                }),
                new docx.Paragraph({
                    text: "                    (подпись)              (расшифровка подписи)",
                }),
                new docx.Paragraph({
                    text: "",
                    spacing: { before: 200 }
                }),
                new docx.Paragraph({
                    text: "М.П.",
                }),
            ],
        }],
    });

    return doc;
}

// Вспомогательная функция для проверки email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
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
    const resultTitle = resultDiv.querySelector('h2');
    const successMessage = resultDiv.querySelector('.success-message p');
    
    if (resultTitle) {
        resultTitle.textContent = '3. Анкета готова';
    }
    
    if (successMessage) {
        successMessage.textContent = 'Анкета юридического лица успешно сформирована';
    }
    
    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
    
    // Автоматически "отправляем" на email (имитация)
    if (userEmail) {
        setTimeout(() => {
            simulateEmailSending();
        }, 1000);
    }
}

// Имитация отправки на email
function simulateEmailSending() {
    const resultContent = document.querySelector('.result-content');
    
    const emailNotification = document.createElement('div');
    emailNotification.style.cssText = `
        background-color: var(--psb-light-gray);
        border: 1px solid var(--psb-orange);
        border-radius: 6px;
        padding: 15px;
        margin: 20px 0;
        text-align: left;
    `;
    
    emailNotification.innerHTML = `
        <strong style="color: var(--psb-orange);">📧 Отправка на email</strong><br>
        <span style="color: var(--psb-dark-gray);">Анкета отправлена на адрес: <strong>${userEmail}</strong></span><br>
        <small style="color: #666;">Проверьте папку "Входящие" и "Спам"</small>
    `;
    
    resultContent.insertBefore(emailNotification, resultContent.querySelector('.btn-download'));
}

// Скачивание документа
function downloadDocument() {
    if (!generatedDocument) {
        alert('Анкета не сгенерирована');
        return;
    }

    docx.Packer.toBlob(generatedDocument).then(function(blob) {
        saveAs(blob, '1_Анкета.docx');
    });
}
