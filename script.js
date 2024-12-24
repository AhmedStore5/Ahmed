// متغيرات عامة للوصول إلى العناصر بسهولة
const modal = document.getElementById('lessonModal');
const modalTitle = document.getElementById('modalTitle');
const lessonDaySelect = document.getElementById('lessonDay');
const lessonNameInput = document.getElementById('lessonName');
const lessonTimeInput = document.getElementById('lessonTime');
const tableBody = document.querySelector('tbody');
const downloadButton = document.querySelector('.download-image-btn');
const errorMsg = document.getElementById('error-message');
let currentDay = null;
let currentLessonIndex = null;
let longPressTimer;
const LONG_PRESS_DURATION = 1300; // مدة الضغط المطول بالمللي ثانية

// ثوابت لتسهيل التعديل لاحقا
const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9] - ([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const DEFAULT_ERROR_MSG = "الرجاء ملء جميع الحقول.";
const EDIT_MODAL_TITLE = "تعديل الدرس";
const ADD_MODAL_TITLE = "إضافة درس جديد";
const SUCCESS_ADD_MSG = "تمت إضافة الدرس بنجاح";
const SUCCESS_EDIT_MSG = "تم تعديل الدرس بنجاح";
const SUCCESS_DELETE_MSG = "تم حذف الدرس بنجاح";
const DELETE_CONFIRM_MSG = "هل أنت متأكد من حذف هذا الدرس؟";
const VALID_TIME_MSG = "تنسيق الوقت غير صحيح، يرجى إدخال الوقت بتنسيق (HH:MM - HH:MM)";
const DOWNLOAD_FILE_NAME = "table_image.png";
const LESSON_COLORS = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c'];
const LESSON_ICONS_MAP = {
    'فيزياء': 'fa-solid fa-atom',
    'رياضيات': 'fa-solid fa-calculator',
    'كيمياء': 'fa-solid fa-flask',
    'أحياء': 'fa-solid fa-dna',
    'حاسوب': 'fa-solid fa-laptop-code',
    ' الغة العربية': 'fa-solid fa-quran',
    'لغة إنجليزية': 'fa-solid fa-language',
     'رسم': 'fa-solid fa-palette',
     'موسيقى': 'fa-solid fa-music',
     'تاريخ': 'fa-solid fa-landmark',
    'جغرافيا': 'fa-solid fa-globe-africa',
    'علوم': 'fa-solid fa-microscope',
     'تربية رياضية': 'fa-solid fa-running',
      'default' : 'fa-solid fa-book'
};

const DB_NAME = 'lessonsDB';
const DB_VERSION = 1;
const DB_STORE_NAME = 'lessonsStore';
let db;


// Function to initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event);
            reject("حدث خطأ أثناء فتح قاعدة البيانات.");
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore(DB_STORE_NAME, { keyPath: 'id', autoIncrement: true });

        };
    });
}



// Load initial data
initDB().then(() => {
    loadData();
});


// Function to open modal for adding/editing lessons
function openModal(day = null, index = null) {
    modalTitle.textContent = (index !== null) ? EDIT_MODAL_TITLE : ADD_MODAL_TITLE;
    lessonDaySelect.value = day || "السبت";
    lessonNameInput.value = "";
    lessonTimeInput.value = "";
    currentDay = day;
    currentLessonIndex = index;
    errorMsg.style.display = 'none';

    if (index !== null && day) {
        loadFromDB().then(lessonsData => {
            if (lessonsData[day] && lessonsData[day][index]) {
                const lesson = lessonsData[day][index];
                lessonNameInput.value = lesson.name;
                lessonTimeInput.value = lesson.time;
            }
        });
    }

    modal.style.display = "block";
}

// Function to close modal
function closeModal() {
    modal.style.display = "none";
    currentDay = null;
    currentLessonIndex = null;
}

// Function to save a lesson
function saveLesson() {
    const lessonDay = lessonDaySelect.value;
    const lessonName = lessonNameInput.value.trim();
    const lessonTime = lessonTimeInput.value.trim();


    if (!lessonName || !lessonTime) {
        errorMsg.textContent = DEFAULT_ERROR_MSG;
        errorMsg.style.display = 'block';
        return;
    }

    if (!TIME_REGEX.test(lessonTime)) {
        errorMsg.textContent = VALID_TIME_MSG;
        errorMsg.style.display = 'block';
        return;
    }

    loadFromDB().then(lessonsData => {
        if (!lessonsData[lessonDay]) {
            lessonsData[lessonDay] = [];
        }

        if (currentLessonIndex !== null) {
            lessonsData[lessonDay][currentLessonIndex] = { name: lessonName, time: lessonTime };
            alert(SUCCESS_EDIT_MSG);
        } else {
            lessonsData[lessonDay].push({ name: lessonName, time: lessonTime });
            alert(SUCCESS_ADD_MSG);
        }
        saveToDB(lessonsData).then(() => {
            closeModal();
            loadData();
        }).catch(err => {
            console.error("Error saving data to IndexedDB:", err);
            alert("حدث خطأ أثناء حفظ البيانات.");
        });
    });
}


// Function to edit a lesson
function editLesson(day, index) {
    openModal(day, index);
}

// Function to delete a lesson
function deleteLesson(day, index) {
    if (confirm(DELETE_CONFIRM_MSG)) {
        loadFromDB().then(lessonsData => {
            if (lessonsData[day] && lessonsData[day][index]) {
                lessonsData[day].splice(index, 1);
                saveToDB(lessonsData).then(() => {
                    loadData();
                    alert(SUCCESS_DELETE_MSG);
                }).catch(err => {
                    console.error("Error deleting data from IndexedDB:", err);
                    alert("حدث خطأ أثناء حذف البيانات.");
                });
            }
        });
    }
}
// Function to load data from IndexedDB
function loadFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE_NAME, 'readonly');
        const objectStore = transaction.objectStore(DB_STORE_NAME);
        const request = objectStore.get(1);
        request.onerror = (event) => {
            console.error("IndexedDB error:", event);
            reject("حدث خطأ أثناء استرجاع البيانات.");
        };
        request.onsuccess = (event) => {
            const data = event.target.result ? event.target.result.data : {};
            resolve(data);
        };
    });
}


// Function to save data to IndexedDB
function saveToDB(data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE_NAME, 'readwrite');
        const objectStore = transaction.objectStore(DB_STORE_NAME);
        const request = objectStore.put({ id: 1, data: data });
        request.onerror = (event) => {
            console.error("IndexedDB error:", event);
            reject("حدث خطأ أثناء حفظ البيانات.");
        };
        request.onsuccess = () => {
            resolve();
        };
    });
}

// Function to determine the icon based on lesson name
function getLessonIcon(lessonName) {
    const lowerCaseName = lessonName.toLowerCase();
    for (const key in LESSON_ICONS_MAP) {
        if (lowerCaseName.includes(key.toLowerCase())) {
            return LESSON_ICONS_MAP[key];
        }
    }
    return LESSON_ICONS_MAP['default'];
}



// Function to load data and render the UI
function loadData() {
    loadFromDB().then(lessonsData => {

        tableBody.querySelectorAll('tr[data-day]').forEach(row => {
            const day = row.getAttribute('data-day');
            const lessonsContainer = row.querySelector('td[data-lessons] ul');
            const timesContainer = row.querySelector('td[data-times] ul');

            lessonsContainer.innerHTML = '';
            timesContainer.innerHTML = '';

            if (lessonsData[day] && lessonsData[day].length > 0) {
                lessonsData[day].forEach((lesson, index) => {
                     const lessonItem = document.createElement('li');
                    const lessonColor = LESSON_COLORS[index % LESSON_COLORS.length];
                     const lessonIcon = getLessonIcon(lesson.name);

                    lessonItem.innerHTML = `
                         <span class="circle-container" style="--lesson-color: ${lessonColor};">
                           <h5 data-lesson-index="${index}">${lesson.name} <i class="${lessonIcon} icon" style="color: ${lessonColor}"></i></h5>
                             <button onclick="editLesson('${day}', ${index})" class="edit-lesson-btn" title="تعديل الدرس"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteLesson('${day}', ${index})" class="delete-lesson-btn" title="حذف الدرس"><i class="fas fa-trash"></i></button>
                         </span>
                    `;

                    const lessonTitle = lessonItem.querySelector('h5');
                    let isLongPress = false;
                    let longPressTimer;

                    lessonTitle.addEventListener('mousedown', function (event) {
                        isLongPress = false;
                        longPressTimer = setTimeout(() => {
                            isLongPress = true;
                            const currentActive = lessonsContainer.querySelector('li.active-lesson');
                            if (currentActive) {
                                currentActive.classList.remove('active-lesson');
                            }
                            lessonItem.classList.add('active-lesson');
                            event.stopPropagation();
                        }, LONG_PRESS_DURATION);

                    });


                    lessonTitle.addEventListener('mouseup', function () {
                        clearTimeout(longPressTimer);
                        if (isLongPress) {
                            isLongPress = false;
                        }
                    });

                    lessonTitle.addEventListener('mouseleave', function () {
                        clearTimeout(longPressTimer);
                        if (isLongPress) {
                            isLongPress = false;
                        }
                    });
                    lessonTitle.addEventListener('touchstart', function (event) {
                        isLongPress = false;
                        longPressTimer = setTimeout(() => {
                            isLongPress = true;
                            const currentActive = lessonsContainer.querySelector('li.active-lesson');
                            if (currentActive) {
                                currentActive.classList.remove('active-lesson');
                            }
                            lessonItem.classList.add('active-lesson');
                            event.stopPropagation();
                        }, LONG_PRESS_DURATION);
                    }, { passive: true }); // Added passive: true to improve scrolling performance

                    lessonTitle.addEventListener('touchend', function () {
                        clearTimeout(longPressTimer);
                        if (isLongPress) {
                            isLongPress = false;
                        }
                    });

                    lessonTitle.addEventListener('touchcancel', function () {
                        clearTimeout(longPressTimer);
                        if (isLongPress) {
                            isLongPress = false;
                        }
                    });
                    lessonsContainer.appendChild(lessonItem);
                    timesContainer.innerHTML += `
                          <li>
                            <h5>${lesson.time}<i class="fas fa-clock icon time"></i></h5>
                        </li>
                  `;
                });
            } else {
                lessonsContainer.innerHTML = `
                      <li>
                          <h5>لا يوجد دروس مضافة <i class="fas fa-exclamation-triangle icon"  style="color: #e74c3c;"></i></h5>
                       </li>
                    `;
            }
        });

    }).catch(err => {
        console.error("Error loading data:", err);
        alert("حدث خطأ أثناء تحميل البيانات.");
    });
}
// Event listener to hide buttons when clicking outside the lessons
window.addEventListener('click', function () {
    const activeLessons = document.querySelectorAll('.lessons-container li.active-lesson');
    activeLessons.forEach(lesson => lesson.classList.remove('active-lesson'));
});


// Function to download table as image
function downloadTableAsImage() {
    downloadButton.disabled = true;
    downloadButton.innerHTML = 'جاري التحميل... <i class="fas fa-spinner fa-spin"></i>';

    new Promise((resolve, reject) => {
        // استخدام requestAnimationFrame لضمان رسم الجدول قبل التقاط الصورة
        requestAnimationFrame(() => {
            try {
                const table = document.querySelector('table');
                if (!table) {
                    reject("عذرًا، لم يتم العثور على الجدول.");
                    return;
                }
                const tableRect = table.getBoundingClientRect();
                if (tableRect.width === 0 || tableRect.height === 0) {
                    reject("عذرًا، الجدول فارغ أو غير مرئي.");
                    return;
                }
                const tableRows = table.querySelectorAll('tbody tr');
                if (tableRows.length === 0) {
                    reject("عذرًا، الجدول لا يحتوي على أي صفوف.");
                    return;
                }

                html2canvas(table, {
                    useCORS: true,
                    scale: 2,
                    //  dpi: 300, // يمكنك تفعيل هذا الخيار إذا كنت بحاجة إليه
                }).then(canvas => {
                    const imgData = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.href = imgData;
                    link.download = DOWNLOAD_FILE_NAME;
                    link.click();
                    resolve();
                }).catch(err => {
                    if (err instanceof Error) {
                        reject("حدث خطأ أثناء إنشاء الصورة: " + err.message);
                    } else {
                        reject("حدث خطأ غير معروف أثناء إنشاء الصورة.");
                    }
                });
            } catch (err) {
                if (err instanceof Error) {
                    reject("حدث خطأ غير متوقع: " + err.message);
                } else {
                    reject("حدث خطأ غير معروف.");
                }
            }
        });
    })
        .then(() => {
            downloadButton.disabled = false;
            downloadButton.innerHTML = 'تحميل الجدول <i class="fas fa-download"></i>';
        })
        .catch(err => {
            downloadButton.disabled = false;
            downloadButton.innerHTML = 'تحميل الجدول <i class="fas fa-download"></i>';
            console.error("Error downloading image: ", err);
            alert(err);
        });
}

// animation when mouse over row
tableBody.querySelectorAll('tr[data-day]').forEach(row => {
    row.addEventListener('mouseover', () => {
        row.classList.add('animate__animated', 'animate__pulse');
    });
    row.addEventListener('mouseout', () => {
        row.classList.remove('animate__animated', 'animate__pulse');
    });
});


window.onclick = function (event) {
    if (event.target == modal) {
        closeModal();
    }
}