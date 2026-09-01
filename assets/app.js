```javascript
/* =========================================================
   DAWAMI1 - APP.JS
   النسخة النهائية
   ========================================================= */


/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
  window.WORKTRACK_CONFIG?.SUPABASE_URL ||
  window.DAWAMI_CONFIG?.SUPABASE_URL ||
  window.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  window.WORKTRACK_CONFIG?.SUPABASE_KEY ||
  window.DAWAMI_CONFIG?.SUPABASE_ANON_KEY ||
  window.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("DAWAMI1: Supabase configuration missing.");

  alert(
    "تعذر تشغيل النظام: إعدادات Supabase غير موجودة."
  );
}

const supabase =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );


/* =========================================================
   EDGE FUNCTION
   ========================================================= */

const FUNCTION_NAME =
  "employee-access";


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentUser = null;
let currentProfile = null;
let currentRole = null;


/* =========================================================
   HELPERS
   ========================================================= */

function $(id) {

  return document.getElementById(id);

}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function money(value) {

  const number =
    Number(value || 0);

  return (
    "₪" +
    number.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    )
  );

}


function minutesToHours(minutes) {

  const total =
    Math.max(
      0,
      Number(minutes || 0)
    );

  const hours =
    Math.floor(total / 60);

  const mins =
    total % 60;

  return (
    `${hours}:${String(mins).padStart(2, "0")}`
  );

}


function formatTime(value) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }


  return date.toLocaleTimeString(
    "ar-PS",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


function formatDate(value) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }


  return date.toLocaleDateString(
    "ar-PS"
  );

}


function showMessage(
  element,
  message,
  type = "error"
) {

  if (!element) {

    return;

  }


  element.innerHTML =
    `<div class="message ${type}">
      ${escapeHtml(message)}
    </div>`;

}


/* =========================================================
   EDGE FUNCTION CALL
   ========================================================= */

async function callEmployeeFunction(
  payload
) {

  const {
    data: {
      session
    }
  } =
    await supabase.auth.getSession();


  const headers = {

    "Content-Type":
      "application/json"

  };


  if (session?.access_token) {

    headers.Authorization =
      `Bearer ${session.access_token}`;

  }


  const {
    data,
    error
  } =
    await supabase.functions.invoke(
      FUNCTION_NAME,
      {
        body: payload,
        headers
      }
    );


  if (error) {

    console.error(
      "Edge Function Error:",
      error
    );

    throw new Error(
      error.message ||
      "تعذر الاتصال بالخادم."
    );

  }


  if (!data) {

    throw new Error(
      "لم يصل رد من الخادم."
    );

  }


  if (data.ok === false) {

    throw new Error(
      data.error ||
      "حدث خطأ في العملية."
    );

  }


  return data;

}


/* =========================================================
   LOGIN UI
   ========================================================= */

function setupLoginUi() {

  const loginInput =
    $("email");

  const loginLabel =
    document.querySelector(
      'label[for="email"]'
    );


  if (loginInput) {

    loginInput.type =
      "email";

    loginInput.placeholder =
      "البريد الإلكتروني";

  }


  if (loginLabel) {

    loginLabel.textContent =
      "البريد الإلكتروني للأدمن";

  }


  const loginForm =
    $("loginForm");


  if (
    loginForm &&
    !document.getElementById(
      "employeeQrLoginArea"
    )
  ) {

    const area =
      document.createElement(
        "div"
      );


    area.id =
      "employeeQrLoginArea";


    area.style.marginTop =
      "20px";


    area.innerHTML = `

      <div style="
        text-align:center;
        border-top:1px solid #ddd;
        padding-top:18px;
      ">

        <strong>
          دخول الموظف
        </strong>

        <p style="
          font-size:13px;
          margin:8px 0;
        ">
          امسح QR الخاص بك للدخول
        </p>

        <button
          type="button"
          id="scanEmployeeQrBtn"
          class="secondary-button"
        >
          مسح QR الموظف
        </button>

        <div
          id="qrReader"
          style="
            width:100%;
            margin-top:15px;
          "
        ></div>

        <div
          id="employeeQrMessage"
          style="margin-top:10px;"
        ></div>

      </div>

    `;


    loginForm.appendChild(
      area
    );


    $("scanEmployeeQrBtn")
      ?.addEventListener(
        "click",
        startQrScanner
      );

  }

}


/* =========================================================
   QR LIBRARY
   ========================================================= */

async function loadQrLibrary() {

  if (
    window.Html5Qrcode
  ) {

    return;

  }


  await new Promise(
    (resolve, reject) => {

      const script =
        document.createElement(
          "script"
        );


      script.src =
        "https://unpkg.com/html5-qrcode";


      script.onload =
        resolve;


      script.onerror =
        reject;


      document.head.appendChild(
        script
      );

    }
  );

}


/* =========================================================
   QR SCANNER
   ========================================================= */

async function startQrScanner() {

  const message =
    $("employeeQrMessage");


  try {

    await loadQrLibrary();


    const reader =
      new Html5Qrcode(
        "qrReader"
      );


    await reader.start(

      {
        facingMode:
          "environment"
      },

      {
        fps: 10,

        qrbox: {
          width: 240,
          height: 240
        }

      },

      async (decodedText) => {

        try {

          await reader.stop();

        } catch (_) {}


        await processQrValue(
          decodedText
        );

      },

      () => {}

    );

  } catch (error) {

    console.error(
      error
    );


    showMessage(
      message,
      "تعذر تشغيل الكاميرا. تأكد من السماح باستخدام الكاميرا.",
      "error"
    );

  }

}


/* =========================================================
   PROCESS QR
   ========================================================= */

async function processQrValue(
  value
) {

  const message =
    $("employeeQrMessage");


  try {

    let code =
      String(value || "")
        .trim();


    /*
      إذا كان QR عبارة عن رابط
    */

    try {

      const url =
        new URL(code);


      const urlCode =
        url.searchParams.get(
          "employee_code"
        );


      if (urlCode) {

        code =
          urlCode.trim();

      }

    } catch (_) {}


    if (!code) {

      throw new Error(
        "QR غير صالح."
      );

    }


    showMessage(
      message,
      "جارٍ تسجيل دخول الموظف...",
      "success"
    );


    const result =
      await callEmployeeFunction({

        action:
          "employee_login",

        login_code:
          code

      });


    if (
      !result.action_link
    ) {

      throw new Error(
        "تعذر إنشاء جلسة الدخول."
      );

    }


    window.location.replace(
      result.action_link
    );

  } catch (error) {

    console.error(
      error
    );


    showMessage(
      message,
      error.message ||
      "QR غير صالح.",
      "error"
    );

  }

}


/* =========================================================
   QR URL LOGIN
   ========================================================= */

async function checkQrUrlLogin() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const employeeCode =
    params.get(
      "employee_code"
    );


  if (!employeeCode) {

    return false;

  }


  try {

    document.body.innerHTML = `

      <div style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        direction:rtl;
        font-family:Arial;
      ">

        <div style="
          text-align:center;
        ">

          <h2>
            DAWAMI1
          </h2>

          <p>
            جارٍ تسجيل دخول الموظف...
          </p>

        </div>

      </div>

    `;


    const result =
      await callEmployeeFunction({

        action:
          "employee_login",

        login_code:
          employeeCode.trim()

      });


    if (
      !result.action_link
    ) {

      throw new Error(
        "تعذر إنشاء جلسة الدخول."
      );

    }


    window.location.replace(
      result.action_link
    );


    return true;

  } catch (error) {

    console.error(
      error
    );


    document.body.innerHTML = `

      <div style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        direction:rtl;
        font-family:Arial;
        padding:30px;
      ">

        <div style="
          max-width:450px;
          text-align:center;
        ">

          <h2>
            تعذر تسجيل الدخول
          </h2>

          <p>
            ${escapeHtml(
              error.message ||
              "QR غير صالح"
            )}
          </p>

          <button
            onclick="location.href='/'"
            class="primary-button"
          >
            العودة
          </button>

        </div>

      </div>

    `;


    return true;

  }

}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

async function handleLogin(
  event
) {

  event.preventDefault();


  const email =
    $("email")
      ?.value
      .trim();


  const password =
    $("password")
      ?.value;


  const message =
    $("loginMessage");


  const button =
    $("loginButton");


  if (!email || !password) {

    showMessage(
      message,
      "أدخل البريد الإلكتروني وكلمة المرور.",
      "error"
    );


    return;

  }


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "جارٍ الدخول...";

  }


  try {

    const {
      data,
      error
    } =
      await supabase.auth
        .signInWithPassword({

          email,
          password

        });


    if (error) {

      throw error;

    }


    currentUser =
      data.user;


    await loadApplication();

  } catch (error) {

    console.error(
      error
    );


    showMessage(
      message,
      error.message ||
      "بيانات الدخول غير صحيحة.",
      "error"
    );

  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "تسجيل الدخول";

    }

  }

}


/* =========================================================
   LOAD PROFILE
   ========================================================= */

async function loadCurrentProfile() {

  if (!currentUser) {

    const {
      data: {
        user
      }
    } =
      await supabase.auth
        .getUser();


    currentUser =
      user;

  }


  if (!currentUser) {

    throw new Error(
      "لم يتم العثور على المستخدم."
    );

  }


  const {
    data,
    error
  } =
    await supabase
      .from("profiles")
      .select("*")
      .eq(
        "id",
        currentUser.id
      )
      .single();


  if (error) {

    throw error;

  }


  currentProfile =
    data;


  currentRole =
    data.role;

}


/* =========================================================
   LOAD APPLICATION
   ========================================================= */

async function loadApplication() {

  await loadCurrentProfile();


  $("loginScreen")
    ?.classList.add(
      "hidden"
    );


  $("forgotScreen")
    ?.classList.add(
      "hidden"
    );


  $("resetScreen")
    ?.classList.add(
      "hidden"
    );


  $("app")
    ?.classList.remove(
      "hidden"
    );


  updateUserUi();

  setupRoleUi();

  await loadDashboard();

}


/* =========================================================
   USER UI
   ========================================================= */

function updateUserUi() {

  const name =
    currentProfile?.full_name ||
    "المستخدم";


  if ($("welcomeText")) {

    $("welcomeText")
      .textContent =
      `مرحباً ${name}`;

  }


  if ($("currentDate")) {

    $("currentDate")
      .textContent =
      new Date()
        .toLocaleDateString(
          "ar-PS",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          }
        );

  }

}


/* =========================================================
   ROLE UI
   ========================================================= */

function setupRoleUi() {

  const admin =
    currentRole === "admin";


  const hr =
    currentRole === "hr";


  $("adminEmployeesNav")
    ?.classList.toggle(
      "hidden",
      !admin
    );


  $("adminAttendanceNav")
    ?.classList.toggle(
      "hidden",
      !(admin || hr)
    );


  $("adminLeavesNav")
    ?.classList.toggle(
      "hidden",
      !(admin || hr)
    );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

  document
    .querySelectorAll(
      ".nav-btn"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          async () => {

            const page =
              button.dataset.page;


            document
              .querySelectorAll(
                ".nav-btn"
              )
              .forEach(
                (item) =>
                  item.classList
                    .remove(
                      "active"
                    )
              );


            button.classList.add(
              "active"
            );


            document
              .querySelectorAll(
                ".page"
              )
              .forEach(
                (section) =>
                  section.classList
                    .remove(
                      "active"
                    )
              );


            const section =
              $(page);


            section?.classList.add(
              "active"
            );


            try {

              if (
                page ===
                "dashboard"
              ) {

                await loadDashboard();

              }


              if (
                page ===
                "attendance"
              ) {

                await loadAttendance();

              }


              if (
                page ===
                "leave"
              ) {

                await loadLeaves();

              }


              if (
                page ===
                "payroll"
              ) {

                await loadPayroll();

              }


              if (
                page ===
                "employees"
              ) {

                await loadEmployees();

              }


              if (
                page ===
                "adminAttendance"
              ) {

                await loadAdminAttendance();

              }


              if (
                page ===
                "adminLeaves"
              ) {

                await loadAdminLeaves();

              }

            } catch (error) {

              console.error(
                error
              );

            }

          }
        );

      }
    );

}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {

  await loadTodayAttendance();

  await loadAttendanceSummary();

  await loadRecentAttendance();

  await loadPayroll();

}


/* =========================================================
   TODAY ATTENDANCE
   ========================================================= */

async function loadTodayAttendance() {

  if (!currentUser) {

    return;

  }


  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );


  const {
    data,
    error
  } =
    await supabase
      .from("attendance")
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      )
      .eq(
        "work_date",
        today
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(1);


  if (error) {

    console.error(
      "تعذر تحميل الدوام:",
      error
    );


    return;

  }


  const record =
    data?.[0];


  const button =
    $("attendanceButton");


  if (!record) {

    if ($("todayStatus")) {

      $("todayStatus")
        .textContent =
        "لم تسجل حضورك";

    }


    if ($("todayMessage")) {

      $("todayMessage")
        .textContent =
        "اضغط لتسجيل بداية الدوام.";

    }


    if (button) {

      button.textContent =
        "تسجيل حضور";

      button.disabled =
        false;

    }


    return;

  }


  if (
    record.clock_in &&
    !record.clock_out
  ) {

    if ($("todayStatus")) {

      $("todayStatus")
        .textContent =
        "الدوام مفتوح";

    }


    if ($("todayMessage")) {

      $("todayMessage")
        .textContent =
        `بدأت الساعة ${formatTime(
          record.clock_in
        )}`;

    }


    if (button) {

      button.textContent =
        "تسجيل انصراف";

      button.disabled =
        false;

    }


    return;

  }


  if (
    record.clock_in &&
    record.clock_out
  ) {

    if ($("todayStatus")) {

      $("todayStatus")
        .textContent =
        "تم إنهاء الدوام";

    }


    if ($("todayMessage")) {

      $("todayMessage")
        .textContent =
        `من ${formatTime(
          record.clock_in
        )} إلى ${formatTime(
          record.clock_out
        )}`;

    }


    if (button) {

      button.textContent =
        "تم تسجيل الدوام";

      button.disabled =
        true;

    }

  }

}


/* =========================================================
   CLOCK IN / OUT
   ========================================================= */

async function handleAttendanceButton() {

  const button =
    $("attendanceButton");


  if (!button) {

    return;

  }


  button.disabled =
    true;


  try {

    const isClockOut =
      button.textContent.includes(
        "انصراف"
      );


    if (isClockOut) {

      const {
        data,
        error
      } =
        await supabase.rpc(
          "clock_out"
        );


      if (error) {

        throw error;

      }

    } else {

      const {
        data,
        error
      } =
        await supabase.rpc(
          "clock_in"
        );


      if (error) {

        throw error;

      }

    }


    await loadDashboard();

  } catch (error) {

    console.error(
      error
    );


    alert(
      error.message ||
      "تعذر تسجيل الدوام."
    );


    button.disabled =
      false;

  }

}


/* =========================================================
   ATTENDANCE SUMMARY
   ========================================================= */

async function loadAttendanceSummary() {

  if (!currentUser) {

    return;

  }


  const firstDay =
    new Date();


  firstDay.setDate(
    1
  );


  const {
    data,
    error
  } =
    await supabase
      .from("attendance")
      .select(
        "regular_minutes,overtime_minutes"
      )
      .eq(
        "employee_id",
        currentUser.id
      )
      .gte(
        "work_date",
        firstDay
          .toISOString()
          .slice(
            0,
            10
          )
      );


  if (error) {

    console.error(
      error
    );


    return;

  }


  let regular =
    0;


  let overtime =
    0;


  for (
    const row of data || []
  ) {

    regular +=
      Number(
        row.regular_minutes || 0
      );


    overtime +=
      Number(
        row.overtime_minutes || 0
      );

  }


  if ($("monthlyHours")) {

    $("monthlyHours")
      .textContent =
      minutesToHours(
        regular
      );

  }


  if ($("overtimeHours")) {

    $("overtimeHours")
      .textContent =
      minutesToHours(
        overtime
      );

  }

}


/* =========================================================
   RECENT ATTENDANCE
   ========================================================= */

async function loadRecentAttendance() {

  if (!currentUser) {

    return;

  }


  const {
    data,
    error
  } =
    await supabase
      .from("attendance")
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      )
      .order(
        "work_date",
        {
          ascending: false
        }
      )
      .limit(10);


  if (error) {

    console.error(
      error
    );


    return;

  }


  renderAttendanceTable(
    $("recentAttendance"),
    data || []
  );

}


/* =========================================================
   ALL ATTENDANCE
   ========================================================= */

async function loadAttendance() {

  if (!currentUser) {

    return;

  }


  const {
    data,
    error
  } =
    await supabase
      .from("attendance")
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      )
      .order(
        "work_date",
        {
          ascending: false
        }
      );


  if (error) {

    alert(
      error.message
    );


    return;

  }


  renderAttendanceTable(
    $("allAttendance"),
    data || []
  );

}


/* =========================================================
   ATTENDANCE TABLE
   ========================================================= */

function renderAttendanceTable(
  tbody,
  rows
) {

  if (!tbody) {

    return;

  }


  if (!rows.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          لا توجد سجلات.
        </td>
      </tr>
    `;


    return;

  }


  tbody.innerHTML =
    rows
      .map(
        (row) => {

          const regular =
            Number(
              row.regular_minutes || 0
            );


          const overtime =
            Number(
              row.overtime_minutes || 0
            );


          return `

            <tr>

              <td>
                ${escapeHtml(
                  row.work_date
                )}
              </td>

              <td>
                ${formatTime(
                  row.clock_in
                )}
              </td>

              <td>
                ${formatTime(
                  row.clock_out
                )}
              </td>

              <td>
                ${minutesToHours(
                  regular
                )}
              </td>

              <td>
                ${minutesToHours(
                  overtime
                )}
              </td>

              <td>
                ${escapeHtml(
                  row.status || "—"
                )}
              </td>

            </tr>

          `;

        }
      )
      .join("");

}


/* =========================================================
   EMPLOYEES
   ========================================================= */

async function loadEmployees() {

  if (
    currentRole !== "admin"
  ) {

    return;

  }


  const {
    data,
    error
  } =
    await supabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          phone,
          identity_number,
          email,
          department,
          job_title,
          monthly_salary,
          work_hours_per_day,
          work_days_per_week,
          is_active,
          login_code
        `
      )
      .order(
        "full_name"
      );


  if (error) {

    alert(
      error.message
    );


    return;

  }


  renderEmployees(
    data || []
  );

}


/* =========================================================
   RENDER EMPLOYEES
   ========================================================= */

function renderEmployees(
  employees
) {

  const tbody =
    $("employeesTable");


  if (!tbody) {

    return;

  }


  if (!employees.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          لا يوجد موظفون.
        </td>
      </tr>
    `;


    return;

  }


  tbody.innerHTML =
    employees
      .map(
        (employee) => {

          return `

            <tr>

              <td>
                ${escapeHtml(
                  employee.full_name
                )}
              </td>

              <td>
                ${escapeHtml(
                  employee.identity_number ||
                  "—"
                )}
              </td>

              <td>
                ${escapeHtml(
                  employee.department ||
                  "—"
                )}
              </td>

              <td>
                ${money(
                  employee.monthly_salary
                )}
              </td>

              <td>
                ${escapeHtml(
                  employee.work_hours_per_day
                )}
              </td>

              <td>
                ${escapeHtml(
                  employee.work_days_per_week
                )}
              </td>

              <td>
                ${
                  employee.is_active
                    ? "فعال"
                    : "غير فعال"
                }
              </td>

              <td>

                <button
                  class="secondary-button small-button"
                  onclick="showEmployeeQr('${employee.id}')"
                >
                  QR
                </button>

              </td>

            </tr>

          `;

        }
      )
      .join("");

}


/* =========================================================
   EMPLOYEE FORM
   ========================================================= */

function setupEmployeeForm() {

  const button =
    $("showEmployeeForm");


  const form =
    $("employeeForm");


  button?.addEventListener(
    "click",
    () => {

      form?.classList.toggle(
        "hidden"
      );

    }
  );


  $("cancelEmployeeForm")
    ?.addEventListener(
      "click",
      () => {

        form?.reset();


        form?.classList.add(
          "hidden"
        );


        if ($("employeeHours")) {

          $("employeeHours")
            .value =
            "8";

        }


        if ($("employeeDays")) {

          $("employeeDays")
            .value =
            "6";

        }

      }
    );


  form?.addEventListener(
    "submit",
    saveEmployee
  );

}


/* =========================================================
   SAVE EMPLOYEE
   ========================================================= */

async function saveEmployee(
  event
) {

  event.preventDefault();


  if (
    currentRole !== "admin"
  ) {

    alert(
      "الأدمن فقط يستطيع إضافة الموظفين."
    );


    return;

  }


  const button =
    event.submitter;


  if (button) {

    button.disabled =
      true;


    button.textContent =
      "جارٍ إنشاء الموظف...";

  }


  try {

    const payload = {

      action:
        "create_employee",

      full_name:
        $("employeeName")
          ?.value
          .trim(),

      identity_number:
        getIdentityNumber(),

      phone:
        $("employeePhone")
          ?.value
          .trim(),

      employee_number:
        $("employeeNumber")
          ?.value
          .trim(),

      department:
        $("employeeDepartment")
          ?.value
          .trim(),

      job_title:
        $("employeeJobTitle")
          ?.value
          .trim(),

      monthly_salary:
        Number(
          $("employeeSalary")
            ?.value || 0
        ),

      work_hours_per_day:
        Number(
          $("employeeHours")
            ?.value || 8
        ),

      work_days_per_week:
        Number(
          $("employeeDays")
            ?.value || 6
        ),

      role:
        "employee"

    };


    if (
      !payload.full_name ||
      !payload.identity_number ||
      !payload.phone
    ) {

      throw new Error(
        "الاسم ورقم الهوية ورقم الهاتف مطلوبة."
      );

    }


    const result =
      await callEmployeeFunction(
        payload
      );


    if (
      !result.employee
    ) {

      throw new Error(
        "تم إنشاء الموظف لكن لم تصل بياناته."
      );

    }


    alert(
      `تم إنشاء الموظف ${result.employee.full_name} بنجاح.`
    );


    $("employeeForm")
      ?.reset();


    $("employeeForm")
      ?.classList.add(
        "hidden"
      );


    if ($("employeeHours")) {

      $("employeeHours")
        .value =
        "8";

    }


    if ($("employeeDays")) {

      $("employeeDays")
        .value =
        "6";

    }


    await loadEmployees();


    if (
      result.qr_url
    ) {

      await showQrModal(
        result.employee,
        result.qr_url
      );

    }

  } catch (error) {

    console.error(
      error
    );


    alert(
      error.message ||
      "تعذر إنشاء الموظف."
    );

  } finally {

    if (button) {

      button.disabled =
        false;


      button.textContent =
        "حفظ البيانات";

    }

  }

}


/* =========================================================
   EXTRA EMPLOYEE FIELDS
   ========================================================= */

function ensureEmployeeExtraFields() {

  const employeeForm =
    $("employeeForm");


  if (!employeeForm) {

    return;

  }


  /*
    رقم الهوية
  */

  if (
    !$("employeeIdentity")
  ) {

    const group =
      document.createElement(
        "div"
      );


    group.className =
      "form-group";


    group.innerHTML = `

      <label for="employeeIdentity">
        رقم الهوية
      </label>

      <input
        type="text"
        id="employeeIdentity"
        inputmode="numeric"
        autocomplete="off"
        placeholder="رقم هوية الموظف"
        required
      >

    `;


    const nameInput =
      $("employeeName");


    const nameGroup =
      nameInput
        ?.closest(
          ".form-group"
        );


    if (
      nameGroup?.parentNode
    ) {

      nameGroup.parentNode
        .insertBefore(
          group,
          nameGroup.nextSibling
        );

    }

  }


  /*
    رقم الهاتف
  */

  if (
    !$("employeePhone")
  ) {

    const group =
      document.createElement(
        "div"
      );


    group.className =
      "form-group";


    group.innerHTML = `

      <label for="employeePhone">
        رقم الهاتف
      </label>

      <input
        type="tel"
        id="employeePhone"
        autocomplete="tel"
        placeholder="رقم هاتف الموظف"
        required
      >

    `;


    const identity =
      $("employeeIdentity");


    const identityGroup =
      identity?.closest(
        ".form-group"
      );


    if (
      identityGroup?.parentNode
    ) {

      identityGroup.parentNode
        .insertBefore(
          group,
          identityGroup.nextSibling
        );

    }

  }


  /*
    البريد الإلكتروني للموظف غير مطلوب
  */

  const email =
    $("employeeEmail");


  if (email) {

    const emailGroup =
      email.closest(
        ".form-group"
      );


    email.required =
      false;


    email.value =
      "";


    if (emailGroup) {

      emailGroup.style.display =
        "none";

    }

  }

}


function getIdentityNumber() {

  return (
    $("employeeIdentity")
      ?.value
      .trim() ||
    ""
  );

}


/* =========================================================
   QR CODE LIBRARY
   ========================================================= */

async function loadQrCodeLibrary() {

  if (
    window.QRCode
  ) {

    return;

  }


  await new Promise(
    (resolve, reject) => {

      const script =
        document.createElement(
          "script"
        );


      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";


      script.onload =
        resolve;


      script.onerror =
        reject;


      document.head.appendChild(
        script
      );

    }
  );

}


/* =========================================================
   GET EMPLOYEE QR
   ========================================================= */

async function showEmployeeQr(
  employeeId
) {

  try {

    const result =
      await callEmployeeFunction({

        action:
          "get_employee_qr",

        employee_id:
          employeeId

      });


    if (
      !result.employee ||
      !result.qr_url
    ) {

      throw new Error(
        "تعذر الحصول على QR الموظف."
      );

    }


    await showQrModal(
      result.employee,
      result.qr_url
    );

  } catch (error) {

    console.error(
      error
    );


    alert(
      error.message ||
      "تعذر عرض QR."
    );

  }

}


/* =========================================================
   QR MODAL
   ========================================================= */

async function showQrModal(
  employee,
  qrUrl
) {

  await loadQrCodeLibrary();


  let modal =
    $("employeeQrModal");


  if (!modal) {

    modal =
      document.createElement(
        "div"
      );


    modal.id =
      "employeeQrModal";


    modal.style.cssText = `

      position:fixed;
      inset:0;
      background:rgba(0,0,0,.65);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:99999;
      direction:rtl;

    `;


    document.body.appendChild(
      modal
    );

  }


  modal.innerHTML = `

    <div style="
      background:white;
      border-radius:18px;
      padding:25px;
      width:min(90vw,430px);
      text-align:center;
      color:#111;
    ">

      <h2>
        QR الموظف
      </h2>

      <h3>
        ${escapeHtml(
          employee.full_name
        )}
      </h3>

      <p>
        رقم الهوية:
        ${escapeHtml(
          employee.identity_number ||
          "—"
        )}
      </p>

      <div
        id="employeeQrCanvas"
        style="
          display:flex;
          justify-content:center;
          margin:20px 0;
        "
      ></div>

      <p style="
        font-size:13px;
        color:#666;
      ">
        هذا الكود هو طريقة دخول الموظف للنظام.
      </p>

      <button
        id="downloadQrButton"
        class="primary-button"
      >
        حفظ QR
      </button>

      <button
        id="closeQrButton"
        class="secondary-button"
        style="margin-top:8px;"
      >
        إغلاق
      </button>

    </div>

  `;


  modal.style.display =
    "flex";


  const container =
    $("employeeQrCanvas");


  new QRCode(
    container,
    {
      text:
        qrUrl,

      width:
        260,

      height:
        260,

      correctLevel:
        QRCode.CorrectLevel.H

    }
  );


  $("closeQrButton")
    ?.addEventListener(
      "click",
      () => {

        modal.style.display =
          "none";

      }
    );


  $("downloadQrButton")
    ?.addEventListener(
      "click",
      () => {

        const canvas =
          container.querySelector(
            "canvas"
          );


        const image =
          container.querySelector(
            "img"
          );


        let url =
          canvas?.toDataURL(
            "image/png"
          );


        if (!url && image) {

          url =
            image.src;

        }


        if (!url) {

          alert(
            "تعذر حفظ QR."
          );


          return;

        }


        const link =
          document.createElement(
            "a"
          );


        link.href =
          url;


        link.download =
          `DAWAMI1-${employee.full_name}-QR.png`;


        document.body.appendChild(
          link
        );


        link.click();


        link.remove();

      }
    );

}


/* =========================================================
   LEAVES
   ========================================================= */

async function loadLeaves() {

  if (!currentUser) {

    return;

  }


  const {
    data,
    error
  } =
    await supabase
      .from("leave_requests")
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(
      "تعذر تحميل طلبات الإجازات:",
      error
    );


    return;

  }


  renderLeaves(
    data || []
  );

}


/* =========================================================
   RENDER LEAVES
   ========================================================= */

function renderLeaves(
  rows
) {

  const container =
    $("leaveList");


  if (!container) {

    return;

  }


  if (!rows.length) {

    container.innerHTML =
      "<p>لا توجد طلبات إجازة.</p>";


    return;

  }


  container.innerHTML =
    rows
      .map(
        (row) => `

          <div class="card">

            <strong>
              ${escapeHtml(
                row.start_date ||
                "—"
              )}
            </strong>

            <span>
              إلى
              ${escapeHtml(
                row.end_date ||
                "—"
              )}
            </span>

            <p>
              ${escapeHtml(
                row.reason ||
                "—"
              )}
            </p>

            <strong>
              ${escapeHtml(
                row.status ||
                "pending"
              )}
            </strong>

          </div>

        `
      )
      .join("");

}


/* =========================================================
   LEAVE FORM
   ========================================================= */

function setupLeaveForm() {

  $("leaveForm")
    ?.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();


        const start =
          $("leaveStart")
            ?.value;


        const end =
          $("leaveEnd")
            ?.value;


        const reason =
          $("leaveReason")
            ?.value
            .trim();


        if (!start || !end) {

          alert(
            "حدد تاريخ الإجازة."
          );


          return;

        }


        if (
          new Date(end) <
          new Date(start)
        ) {

          alert(
            "تاريخ النهاية يجب أن يكون بعد تاريخ البداية."
          );


          return;

        }


        const startDate =
          new Date(
            `${start}T00:00:00`
          );


        const endDate =
          new Date(
            `${end}T00:00:00`
          );


        const totalDays =
          Math.floor(
            (
              endDate -
              startDate
            ) /
            (
              1000 *
              60 *
              60 *
              24
            )
          ) + 1;


        try {

          const {
            error
          } =
            await supabase
              .from(
                "leave_requests"
              )
              .insert({

                employee_id:
                  currentUser.id,

                start_date:
                  start,

                end_date:
                  end,

                total_days:
                  totalDays,

                reason:
                  reason || null,

                status:
                  "pending"

              });


          if (error) {

            throw error;

          }


          event.target.reset();


          await loadLeaves();


          alert(
            "تم إرسال طلب الإجازة."
          );

        } catch (error) {

          console.error(
            error
          );


          alert(
            error.message ||
            "تعذر إرسال طلب الإجازة."
          );

        }

      }
    );

}


/* =========================================================
   PAYROLL
   ========================================================= */

async function loadPayroll() {

  if (
    !currentProfile ||
    !currentUser
  ) {

    return;

  }


  const base =
    Number(
      currentProfile.monthly_salary ||
      0
    );


  /*
    ملاحظة:
    لا نفترض وجود جدول overtime
    لأنه غير موجود ضمن الجداول التي فحصناها.
    نحسب الإضافي من attendance.
  */

  const {
    data: attendanceRows,
    error:
      attendanceError
  } =
    await supabase
      .from("attendance")
      .select(
        "overtime_minutes"
      )
      .eq(
        "employee_id",
        currentUser.id
      );


  if (attendanceError) {

    console.error(
      "تعذر تحميل الإضافي:",
      attendanceError
    );

  }


  const overtimeMinutes =
    (attendanceRows || [])
      .reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row.overtime_minutes || 0
          ),
        0
      );


  /*
    القيمة المالية للإضافي
    حالياً نعرض الدقائق فقط إذا لم
    يكن هناك إعداد منفصل لمعامل الإضافي.
  */

  const overtimePay =
    0;


  const {
    data:
      deductionRows,
    error:
      deductionError
  } =
    await supabase
      .from("deductions")
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      );


  if (deductionError) {

    console.error(
      "تعذر تحميل الخصومات:",
      deductionError
    );

  }


  const deductions =
    (deductionRows || [])
      .filter(
        row =>
          !row.status ||
          row.status ===
          "approved"
      )
      .reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row.amount || 0
          ),
        0
      );


  const total =
    base +
    overtimePay -
    deductions;


  if ($("baseSalary")) {

    $("baseSalary")
      .textContent =
      money(base);

  }


  if ($("overtimePay")) {

    $("overtimePay")
      .textContent =
      money(overtimePay);

  }


  if ($("deductions")) {

    $("deductions")
      .textContent =
      money(deductions);

  }


  if ($("totalSalary")) {

    $("totalSalary")
      .textContent =
      money(total);

  }


  if ($("expectedSalary")) {

    $("expectedSalary")
      .textContent =
      money(total);

  }


  /*
    إذا كان هناك عنصر لعرض ساعات الإضافي
  */

  if ($("payrollOvertimeHours")) {

    $("payrollOvertimeHours")
      .textContent =
      minutesToHours(
        overtimeMinutes
      );

  }

}


/* =========================================================
   ADMIN ATTENDANCE
   ========================================================= */

async function loadAdminAttendance() {

  if (
    currentRole !== "admin" &&
    currentRole !== "hr"
  ) {

    return;

  }


  const {
    data,
    error
  } =
    await supabase
      .from("attendance")
      .select("*")
      .order(
        "work_date",
        {
          ascending: false
        }
      )
      .limit(500);


  if (error) {

    alert(
      error.message
    );


    return;

  }


  const employeeIds =
    [
      ...new Set(
        (data || [])
          .map(
            row =>
              row.employee_id
          )
          .filter(Boolean)
      )
    ];


  let profiles =
    [];


  if (
    employeeIds.length
  ) {

    const result =
      await supabase
        .from("profiles")
        .select(
          "id,full_name"
        )
        .in(
          "id",
          employeeIds
        );


    if (result.error) {

      console.error(
        result.error
      );

    }


    profiles =
      result.data || [];

  }


  const names =
    new Map(
      profiles.map(
        p => [
          p.id,
          p.full_name
        ]
      )
    );


  const tbody =
    $("adminAttendanceTable");


  if (!tbody) {

    return;

  }


  if (!data?.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          لا توجد سجلات حضور.
        </td>
      </tr>
    `;


    return;

  }


  tbody.innerHTML =
    data
      .map(
        row => `

          <tr>

            <td>
              ${escapeHtml(
                names.get(
                  row.employee_id
                ) || "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                row.work_date
              )}
            </td>

            <td>
              ${formatTime(
                row.clock_in
              )}
            </td>

            <td>
              ${formatTime(
                row.clock_out
              )}
            </td>

            <td>
              ${minutesToHours(
                row.regular_minutes
              )}
            </td>

            <td>
              ${minutesToHours(
                row.overtime_minutes
              )}
            </td>

            <td>
              ${escapeHtml(
                row.status || "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                row.notes || "—"
              )}
            </td>

          </tr>

        `
      )
      .join("");

}


/* =========================================================
   ADMIN LEAVES
   ========================================================= */

async function loadAdminLeaves() {

  if (
    currentRole !== "admin" &&
    currentRole !== "hr"
  ) {

    return;

  }


  const {
    data,
    error
  } =
    await supabase
      .from(
        "leave_requests"
      )
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(500);


  if (error) {

    alert(
      error.message
    );


    return;

  }


  const employeeIds =
    [
      ...new Set(
        (data || [])
          .map(
            row =>
              row.employee_id
          )
          .filter(Boolean)
      )
    ];


  let profiles =
    [];


  if (
    employeeIds.length
  ) {

    const result =
      await supabase
        .from("profiles")
        .select(
          "id,full_name"
        )
        .in(
          "id",
          employeeIds
        );


    profiles =
      result.data || [];

  }


  const names =
    new Map(
      profiles.map(
        p => [
          p.id,
          p.full_name
        ]
      )
    );


  const tbody =
    $("adminLeavesTable");


  if (!tbody) {

    return;

  }


  if (!data?.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          لا توجد طلبات إجازة.
        </td>
      </tr>
    `;


    return;

  }


  tbody.innerHTML =
    data
      .map(
        row => `

          <tr>

            <td>
              ${escapeHtml(
                names.get(
                  row.employee_id
                ) || "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                row.start_date ||
                "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                row.end_date ||
                "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                row.total_days ??
                "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                row.reason ||
                "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                row.status ||
                "pending"
              )}
            </td>

            <td>
              ${escapeHtml(
                row.review_note ||
                "—"
              )}
            </td>

          </tr>

        `
      )
      .join("");

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

  try {

    await supabase.auth
      .signOut();

  } catch (error) {

    console.error(
      error
    );

  }


  currentUser =
    null;


  currentProfile =
    null;


  currentRole =
    null;


  $("app")
    ?.classList.add(
      "hidden"
    );


  $("loginScreen")
    ?.classList.remove(
      "hidden"
    );

}


/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

function setupForgotPassword() {

  $("forgotPasswordBtn")
    ?.addEventListener(
      "click",
      () => {

        $("loginScreen")
          ?.classList.add(
            "hidden"
          );


        $("forgotScreen")
          ?.classList.remove(
            "hidden"
          );

      }
    );


  $("backToLoginBtn")
    ?.addEventListener(
      "click",
      () => {

        $("forgotScreen")
          ?.classList.add(
            "hidden"
          );


        $("loginScreen")
          ?.classList.remove(
            "hidden"
          );

      }
    );


  $("forgotForm")
    ?.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();


        const email =
          $("forgotEmail")
            ?.value
            .trim();


        const message =
          $("forgotMessage");


        if (!email) {

          showMessage(
            message,
            "أدخل البريد الإلكتروني.",
            "error"
          );


          return;

        }


        try {

          const {
            error
          } =
            await supabase.auth
              .resetPasswordForEmail(
                email,
                {
                  redirectTo:
                    window.location.origin
                }
              );


          if (error) {

            throw error;

          }


          showMessage(
            message,
            "تم إرسال رابط الاستعادة إذا كان الحساب موجوداً.",
            "success"
          );

        } catch (error) {

          showMessage(
            message,
            error.message ||
            "تعذر إرسال رابط الاستعادة.",
            "error"
          );

        }

      }
    );

}


/* =========================================================
   RESET PASSWORD
   ========================================================= */

function setupResetPassword() {

  $("resetForm")
    ?.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();


        const password =
          $("newPassword")
            ?.value;


        const confirm =
          $("confirmPassword")
            ?.value;


        if (!password) {

          showMessage(
            $("resetMessage"),
            "أدخل كلمة المرور الجديدة.",
            "error"
          );


          return;

        }


        if (
          password.length < 6
        ) {

          showMessage(
            $("resetMessage"),
            "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
            "error"
          );


          return;

        }


        if (
          password !== confirm
        ) {

          showMessage(
            $("resetMessage"),
            "كلمتا المرور غير متطابقتين.",
            "error"
          );


          return;

        }


        const {
          error
        } =
          await supabase.auth
            .updateUser({
              password
            });


        if (error) {

          showMessage(
            $("resetMessage"),
            error.message,
            "error"
          );


          return;

        }


        showMessage(
          $("resetMessage"),
          "تم تغيير كلمة المرور بنجاح.",
          "success"
        );

      }
    );

}


/* =========================================================
   AUTH STATE
   ========================================================= */

function setupAuthListener() {

  supabase.auth
    .onAuthStateChange(
      async (
        event,
        session
      ) => {

        if (
          session?.user
        ) {

          currentUser =
            session.user;


          try {

            await loadApplication();

          } catch (error) {

            console.error(
              "تعذر تحميل التطبيق:",
              error
            );

          }

        } else {

          currentUser =
            null;


          currentProfile =
            null;


          currentRole =
            null;

        }

      }
    );

}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function init() {

  /*
    أولاً:
    فحص دخول الموظف عبر QR
  */

  const handledQr =
    await checkQrUrlLogin();


  if (handledQr) {

    return;

  }


  /*
    إعداد الواجهة
  */

  setupLoginUi();

  ensureEmployeeExtraFields();

  setupNavigation();

  setupEmployeeForm();

  setupLeaveForm();

  setupForgotPassword();

  setupResetPassword();

  setupAuthListener();


  /*
    تسجيل الدخول للأدمن
  */

  $("loginForm")
    ?.addEventListener(
      "submit",
      handleLogin
    );


  /*
    زر الحضور والانصراف
  */

  $("attendanceButton")
    ?.addEventListener(
      "click",
      handleAttendanceButton
    );


  /*
    تسجيل الخروج
  */

  $("logoutBtn")
    ?.addEventListener(
      "click",
      logout
    );


  /*
    فحص الجلسة الحالية
  */

  const {
    data: {
      session
    }
  } =
    await supabase.auth
      .getSession();


  if (
    session?.user
  ) {

    currentUser =
      session.user;


    try {

      await loadApplication();

    } catch (error) {

      console.error(
        error
      );


      await supabase.auth
        .signOut();

    }

  }

}


/* =========================================================
   START APP
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);
```
