/* =========================================================
   DAWAMI1
   FINAL APP.JS
========================================================= */


/* =========================================================
   SUPABASE CONFIG
========================================================= */

const SUPABASE_URL =
  window.DAWAMI_CONFIG?.SUPABASE_URL ||
  window.WORKTRACK_CONFIG?.SUPABASE_URL ||
  window.SUPABASE_URL ||
  "";


const SUPABASE_KEY =
  window.DAWAMI_CONFIG?.SUPABASE_ANON_KEY ||
  window.WORKTRACK_CONFIG?.SUPABASE_KEY ||
  window.SUPABASE_ANON_KEY ||
  "";


/*
  IMPORTANT:
  We intentionally call the client "supabaseClient"
  to avoid the common:

  Identifier 'supabase' has already been declared

  problem.
*/

if (
  !SUPABASE_URL ||
  !SUPABASE_KEY
) {

  alert(
    "إعدادات Supabase غير موجودة."
  );

  throw new Error(
    "Missing Supabase configuration"
  );
}


if (
  !window.supabase ||
  typeof window.supabase.createClient !==
    "function"
) {

  alert(
    "مكتبة Supabase غير محملة."
  );

  throw new Error(
    "Supabase library missing"
  );
}


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
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

let qrScanner = null;


/* =========================================================
   HELPERS
========================================================= */

function $(id) {
  return document.getElementById(id);
}


function escapeHtml(value) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );
}


function money(value) {

  const number =
    Number(
      value || 0
    );


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


function minutesToHours(
  minutes
) {

  const total =
    Math.max(
      0,
      Number(
        minutes || 0
      )
    );


  const hours =
    Math.floor(
      total / 60
    );


  const mins =
    total % 60;


  return (
    `${hours}:${String(
      mins
    ).padStart(
      2,
      "0"
    )}`
  );
}


function formatTime(
  value
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(
      value
    );


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


function formatDate(
  value
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(
      value
    );


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
    `
      <div class="message ${type}">
        ${escapeHtml(
          message
        )}
      </div>
    `;
}


/* =========================================================
   EDGE FUNCTION CALL
========================================================= */

async function callEmployeeFunction(
  payload
) {

  const {
    data: sessionData
  } =
    await supabaseClient.auth
      .getSession();


  const session =
    sessionData?.session;


  const headers = {
    "Content-Type":
      "application/json"
  };


  if (
    session?.access_token
  ) {

    headers.Authorization =
      `Bearer ${session.access_token}`;
  }


  const {
    data,
    error
  } =
    await supabaseClient.functions.invoke(
      FUNCTION_NAME,
      {
        body:
          payload,

        headers
      }
    );


  if (error) {

    console.error(
      "Edge Function error:",
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


  if (
    data.ok === false
  ) {

    throw new Error(
      data.error ||
      "حدث خطأ."
    );
  }


  return data;
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


  document.body.innerHTML =
    `
      <div style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        direction:rtl;
        font-family:Arial;
        padding:25px;
      ">

        <div style="
          text-align:center;
          max-width:420px;
        ">

          <h1>
            DAWAMI1
          </h1>

          <p>
            جارٍ تسجيل دخول الموظف...
          </p>

        </div>

      </div>
    `;


  try {

    const result =
      await callEmployeeFunction({

        action:
          "employee_login",

        login_code:
          employeeCode

      });


    if (
      !result.action_link
    ) {

      throw new Error(
        "تعذر إنشاء جلسة الدخول."
      );
    }


    /*
      Redirect to Supabase generated
      magic-link.

      Supabase Auth will return to
      the site and automatically
      initialize the session.
    */

    window.location.replace(
      result.action_link
    );


    return true;

  } catch (error) {

    console.error(
      error
    );


    document.body.innerHTML =
      `
        <div style="
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          direction:rtl;
          font-family:Arial;
          padding:25px;
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
                "QR غير صالح."
              )}
            </p>

            <button
              onclick="location.href=location.origin"
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
   LOGIN
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


  if (
    !email ||
    !password
  ) {

    showMessage(
      message,
      "أدخل البريد وكلمة المرور.",
      "error"
    );

    return;
  }


  button.disabled =
    true;


  button.textContent =
    "جارٍ الدخول...";


  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth
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

    button.disabled =
      false;

    button.textContent =
      "تسجيل الدخول";
  }
}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadCurrentProfile() {

  if (!currentUser) {

    const {
      data
    } =
      await supabaseClient.auth
        .getUser();

    currentUser =
      data?.user;
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
    await supabaseClient
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


  if (
    !currentProfile.is_active
  ) {

    await supabaseClient.auth
      .signOut();

    throw new Error(
      "هذا الحساب غير نشط."
    );
  }


  $("loginScreen")
    ?.classList
    .add("hidden");


  $("forgotScreen")
    ?.classList
    .add("hidden");


  $("resetScreen")
    ?.classList
    .add("hidden");


  $("app")
    ?.classList
    .remove("hidden");


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


  if (
    $("welcomeText")
  ) {

    $("welcomeText")
      .textContent =
      `مرحباً ${name}`;
  }


  if (
    $("currentDate")
  ) {

    $("currentDate")
      .textContent =
      new Date()
        .toLocaleDateString(
          "ar-PS",
          {
            weekday:
              "long",

            year:
              "numeric",

            month:
              "long",

            day:
              "numeric"
          }
        );
  }
}


/* =========================================================
   ROLE UI
========================================================= */

function setupRoleUi() {

  const isAdmin =
    currentRole ===
    "admin";


  const isHr =
    currentRole ===
    "hr";


  $("adminEmployeesNav")
    ?.classList
    .toggle(
      "hidden",
      !isAdmin
    );


  $("adminAttendanceNav")
    ?.classList
    .toggle(
      "hidden",
      !(
        isAdmin ||
        isHr
      )
    );


  $("adminLeavesNav")
    ?.classList
    .toggle(
      "hidden",
      !(
        isAdmin ||
        isHr
      )
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
      button => {

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
                item =>
                  item.classList
                    .remove(
                      "active"
                    )
              );


            button.classList
              .add(
                "active"
              );


            document
              .querySelectorAll(
                ".page"
              )
              .forEach(
                section =>
                  section.classList
                    .remove(
                      "active"
                    )
              );


            $(page)
              ?.classList
              .add(
                "active"
              );


            try {

              if (
                page ===
                "dashboard"
              ) {

                await loadDashboard();

              } else if (
                page ===
                "attendance"
              ) {

                await loadAttendance();

              } else if (
                page ===
                "leave"
              ) {

                await loadLeaves();

              } else if (
                page ===
                "payroll"
              ) {

                await loadPayroll();

              } else if (
                page ===
                "employees"
              ) {

                await loadEmployees();

              } else if (
                page ===
                "adminAttendance"
              ) {

                await loadAdminAttendance();

              } else if (
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
   GET TODAY RECORD
========================================================= */

async function getTodayAttendanceRecord() {

  if (!currentUser) {
    return null;
  }


  const today =
    new Date()
      .toLocaleDateString(
        "en-CA"
      );


  const {
    data,
    error
  } =
    await supabaseClient
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
      .maybeSingle();


  if (error) {

    console.error(
      error
    );

    return null;
  }


  return data;
}


/* =========================================================
   TODAY ATTENDANCE
========================================================= */

async function loadTodayAttendance() {

  const record =
    await getTodayAttendanceRecord();


  const button =
    $("attendanceButton");


  const breakButton =
    $("breakButton");


  if (!record) {

    $("todayStatus")
      .textContent =
      "لم تسجل حضورك";


    $("todayMessage")
      .textContent =
      "اضغط لتسجيل بداية الدوام.";


    button.textContent =
      "تسجيل حضور";


    button.disabled =
      false;


    breakButton
      ?.classList
      .add(
        "hidden"
      );


    return;
  }


  if (
    record.clock_in &&
    !record.clock_out
  ) {

    $("todayStatus")
      .textContent =
      "الدوام مفتوح";


    $("todayMessage")
      .textContent =
      `بدأت الساعة ${formatTime(
        record.clock_in
      )}`;


    button.textContent =
      "تسجيل انصراف";


    button.disabled =
      false;


    await updateBreakButton(
      record
    );


    return;
  }


  if (
    record.clock_out
  ) {

    $("todayStatus")
      .textContent =
      "تم إنهاء الدوام";


    $("todayMessage")
      .textContent =
      `من ${formatTime(
        record.clock_in
      )} إلى ${formatTime(
        record.clock_out
      )}`;


    button.textContent =
      "تم تسجيل الدوام";


    button.disabled =
      true;


    breakButton
      ?.classList
      .add(
        "hidden"
      );
  }
}


/* =========================================================
   BREAK BUTTON
========================================================= */

async function updateBreakButton(
  attendance
) {

  const breakButton =
    $("breakButton");


  if (!breakButton) {
    return;
  }


  breakButton
    .classList
    .remove(
      "hidden"
    );


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "attendance_breaks"
      )
      .select("*")
      .eq(
        "attendance_id",
        attendance.id
      )
      .is(
        "break_end",
        null
      )
      .maybeSingle();


  if (error) {

    console.error(
      error
    );

    return;
  }


  if (data) {

    breakButton.textContent =
      "▶ إنهاء البريك";

    breakButton.dataset.mode =
      "end";

    $("todayStatus")
      .textContent =
      "أنت في بريك";


    $("todayMessage")
      .textContent =
      `بدأ البريك الساعة ${formatTime(
        data.break_start
      )}`;

  } else {

    breakButton.textContent =
      "☕ بدء بريك";

    breakButton.dataset.mode =
      "start";
  }
}


/* =========================================================
   ATTENDANCE BUTTON
========================================================= */

async function handleAttendanceButton() {

  const button =
    $("attendanceButton");


  button.disabled =
    true;


  try {

    const record =
      await getTodayAttendanceRecord();


    if (
      record &&
      record.clock_in &&
      !record.clock_out
    ) {

      if (
        await hasOpenBreak(
          record.id
        )
      ) {

        throw new Error(
          "أنهِ البريك أولاً."
        );
      }


      const {
        error
      } =
        await supabaseClient.rpc(
          "clock_out"
        );


      if (error) {
        throw error;
      }


    } else {

      const {
        error
      } =
        await supabaseClient.rpc(
          "clock_in"
        );


      if (error) {
        throw error;
      }
    }


    await loadDashboard();

    await loadAttendance();

  } catch (error) {

    console.error(
      error
    );


    alert(
      error.message ||
      "تعذر تسجيل الدوام."
    );

  } finally {

    button.disabled =
      false;
  }
}


/* =========================================================
   CHECK OPEN BREAK
========================================================= */

async function hasOpenBreak(
  attendanceId
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "attendance_breaks"
      )
      .select("id")
      .eq(
        "attendance_id",
        attendanceId
      )
      .is(
        "break_end",
        null
      )
      .maybeSingle();


  if (error) {
    throw error;
  }


  return Boolean(
    data
  );
}


/* =========================================================
   BREAK ACTION
========================================================= */

async function handleBreakButton() {

  const button =
    $("breakButton");


  if (!button) {
    return;
  }


  button.disabled =
    true;


  try {

    const mode =
      button.dataset.mode;


    if (
      mode ===
      "end"
    ) {

      const {
        error
      } =
        await supabaseClient.rpc(
          "end_break"
        );


      if (error) {
        throw error;
      }


    } else {

      const {
        error
      } =
        await supabaseClient.rpc(
          "start_break"
        );


      if (error) {
        throw error;
      }
    }


    await loadTodayAttendance();

    await loadAttendance();

  } catch (error) {

    console.error(
      error
    );


    alert(
      error.message ||
      "تعذر تسجيل البريك."
    );

  } finally {

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


  const firstDayString =
    firstDay
      .toLocaleDateString(
        "en-CA"
      );


  const {
    data,
    error
  } =
    await supabaseClient
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
        firstDayString
      );


  if (error) {

    console.error(
      error
    );

    return;
  }


  const regular =
    (data || [])
      .reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row.regular_minutes ||
            0
          ),
        0
      );


  const overtime =
    (data || [])
      .reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row.overtime_minutes ||
            0
          ),
        0
      );


  $("monthlyHours")
    .textContent =
    minutesToHours(
      regular
    );


  $("overtimeHours")
    .textContent =
    minutesToHours(
      overtime
    );
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
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      )
      .order(
        "work_date",
        {
          ascending:
            false
        }
      )
      .limit(
        10
      );


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
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      )
      .order(
        "work_date",
        {
          ascending:
            false
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

    tbody.innerHTML =
      `
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
        row => {

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
                  row.status ||
                  "—"
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
    currentRole !==
    "admin"
  ) {
    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select(`
        id,
        full_name,
        phone,
        identity_number,
        email,
        employee_number,
        department,
        job_title,
        monthly_salary,
        work_hours_per_day,
        work_days_per_week,
        is_active,
        login_code
      `)
      .eq(
        "role",
        "employee"
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

    tbody.innerHTML =
      `
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
        employee => `
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
                class="secondary-button"
                onclick="showEmployeeQr('${employee.id}')"
              >
                QR
              </button>

            </td>

          </tr>
        `
      )
      .join("");
}


/* =========================================================
   EMPLOYEE FORM
========================================================= */

function setupEmployeeForm() {

  $("showEmployeeForm")
    ?.addEventListener(
      "click",
      () => {

        $("employeeForm")
          ?.classList
          .toggle(
            "hidden"
          );

      }
    );


  $("cancelEmployeeForm")
    ?.addEventListener(
      "click",
      () => {

        const form =
          $("employeeForm")
            ?.querySelector(
              "form"
            );


        form?.reset();


        $("employeeHours")
          .value =
          "8";


        $("employeeDays")
          .value =
          "6";


        $("employeeForm")
          ?.classList
          .add(
            "hidden"
          );
      }
    );


  $("employeeForm")
    ?.querySelector(
      "form"
    )
    ?.addEventListener(
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
    currentRole !==
    "admin"
  ) {

    alert(
      "الأدمن فقط يستطيع إضافة الموظفين."
    );

    return;
  }


  const button =
    event.submitter;


  button.disabled =
    true;


  button.textContent =
    "جارٍ إنشاء الموظف...";


  try {

    const payload = {

      action:
        "create_employee",

      full_name:
        $("employeeName")
          .value
          .trim(),

      identity_number:
        $("employeeIdentity")
          .value
          .trim(),

      phone:
        $("employeePhone")
          .value
          .trim(),

      employee_number:
        $("employeeNumber")
          .value
          .trim(),

      department:
        $("employeeDepartment")
          .value
          .trim(),

      job_title:
        $("employeeJobTitle")
          .value
          .trim(),

      monthly_salary:
        Number(
          $("employeeSalary")
            .value ||
          0
        ),

      work_hours_per_day:
        Number(
          $("employeeHours")
            .value ||
          8
        ),

      work_days_per_week:
        Number(
          $("employeeDays")
            .value ||
          6
        )

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


    alert(
      `تم إنشاء الموظف ${result.employee.full_name} بنجاح.`
    );


    const form =
      $("employeeForm")
        ?.querySelector(
          "form"
        );


    form?.reset();


    $("employeeHours")
      .value =
      "8";


    $("employeeDays")
      .value =
      "6";


    $("employeeForm")
      ?.classList
      .add(
        "hidden"
      );


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

    button.disabled =
      false;

    button.textContent =
      "حفظ الموظف";
  }
}


/* =========================================================
   EMPLOYEE QR
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
      "تعذر إنشاء QR."
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

  let modal =
    $("employeeQrModal");


  if (!modal) {

    modal =
      document.createElement(
        "div"
      );


    modal.id =
      "employeeQrModal";


    modal.className =
      "qr-modal";


    document.body
      .appendChild(
        modal
      );
  }


  modal.innerHTML =
    `
      <div class="qr-modal-content">

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
          class="qr-container"
        ></div>


        <p class="muted">
          هذا الكود يستخدم لدخول الموظف إلى DAWAMI1.
        </p>


        <button
          id="downloadQrButton"
          class="primary-button full"
        >
          حفظ QR
        </button>


        <button
          id="closeQrButton"
          class="secondary-button full"
          style="margin-top:8px"
        >
          إغلاق
        </button>

      </div>
    `;


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
    .addEventListener(
      "click",
      () => {

        modal
          .classList
          .add(
            "hidden"
          );

      }
    );


  $("downloadQrButton")
    .addEventListener(
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


        if (
          !url &&
          image
        ) {

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


        link.click();
      }
    );


  modal
    .classList
    .remove(
      "hidden"
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
    await supabaseClient
      .from(
        "leave_requests"
      )
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      );


  if (error) {

    console.error(
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
        row => `

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
              الحالة:
              ${escapeHtml(
                row.status ||
                "pending"
              )}
            </strong>

            ${
              row.review_note
                ? `
                  <p>
                    ملاحظة:
                    ${escapeHtml(
                      row.review_note
                    )}
                  </p>
                `
                : ""
            }

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
      async event => {

        event.preventDefault();


        const start =
          $("leaveStart")
            .value;


        const end =
          $("leaveEnd")
            .value;


        const reason =
          $("leaveReason")
            .value
            .trim();


        if (
          !start ||
          !end
        ) {

          alert(
            "حدد تاريخ الإجازة."
          );

          return;
        }


        if (
          end < start
        ) {

          alert(
            "تاريخ النهاية يجب أن يكون بعد تاريخ البداية."
          );

          return;
        }


        try {

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


          const {
            error
          } =
            await supabaseClient
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
                  reason,

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


  const {
    data:
      overtimeRows
  } =
    await supabaseClient
      .from(
        "overtime"
      )
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      );


  const {
    data:
      deductionRows
  } =
    await supabaseClient
      .from(
        "deductions"
      )
      .select("*")
      .eq(
        "employee_id",
        currentUser.id
      );


  const overtime =
    (overtimeRows || [])
      .reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row.amount ||
            0
          ),
        0
      );


  const deductions =
    (deductionRows || [])
      .reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row.amount ||
            0
          ),
        0
      );


  const total =
    base +
    overtime -
    deductions;


  $("baseSalary")
    .textContent =
    money(
      base
    );


  $("overtimePay")
    .textContent =
    money(
      overtime
    );


  $("deductions")
    .textContent =
    money(
      deductions
    );


  $("totalSalary")
    .textContent =
    money(
      total
    );


  $("expectedSalary")
    .textContent =
    money(
      total
    );
}


/* =========================================================
   ADMIN ATTENDANCE
========================================================= */

async function loadAdminAttendance() {

  if (
    currentRole !==
      "admin" &&
    currentRole !==
      "hr"
  ) {
    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "attendance"
      )
      .select("*")
      .order(
        "work_date",
        {
          ascending:
            false
        }
      )
      .limit(
        500
      );


  if (error) {

    alert(
      error.message
    );

    return;
  }


  const ids =
    [
      ...new Set(
        (data || [])
          .map(
            row =>
              row.employee_id
          )
      )
    ];


  let profiles =
    [];


  if (ids.length) {

    const result =
      await supabaseClient
        .from(
          "profiles"
        )
        .select(
          "id,full_name"
        )
        .in(
          "id",
          ids
        );


    if (
      !result.error
    ) {

      profiles =
        result.data ||
        [];
    }
  }


  const names =
    new Map(
      profiles.map(
        profile => [
          profile.id,
          profile.full_name
        ]
      )
    );


  const tbody =
    $("adminAttendanceTable");


  if (!tbody) {
    return;
  }


  if (
    !data?.length
  ) {

    tbody.innerHTML =
      `
        <tr>
          <td colspan="8">
            لا توجد سجلات.
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
                ) ||
                "—"
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
                row.status
              )}
            </td>

            <td>
              ${escapeHtml(
                row.notes ||
                "—"
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
    currentRole !==
      "admin" &&
    currentRole !==
      "hr"
  ) {
    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "leave_requests"
      )
      .select("*")
      .order(
        "created_at",
        {
          ascending:
            false
        }
      )
      .limit(
        500
      );


  if (error) {

    alert(
      error.message
    );

    return;
  }


  const ids =
    [
      ...new Set(
        (data || [])
          .map(
            row =>
              row.employee_id
          )
      )
    ];


  let profiles =
    [];


  if (ids.length) {

    const result =
      await supabaseClient
        .from(
          "profiles"
        )
        .select(
          "id,full_name"
        )
        .in(
          "id",
          ids
        );


    if (
      !result.error
    ) {

      profiles =
        result.data ||
        [];
    }
  }


  const names =
    new Map(
      profiles.map(
        profile => [
          profile.id,
          profile.full_name
        ]
      )
    );


  const tbody =
    $("adminLeavesTable");


  if (!tbody) {
    return;
  }


  if (
    !data?.length
  ) {

    tbody.innerHTML =
      `
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
                ) ||
                "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                row.start_date
              )}
            </td>

            <td>
              ${escapeHtml(
                row.end_date
              )}
            </td>

            <td>
              ${escapeHtml(
                row.total_days
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
                row.status
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
   FORGOT PASSWORD
========================================================= */

function setupForgotPassword() {

  $("forgotPasswordBtn")
    ?.addEventListener(
      "click",
      () => {

        $("loginScreen")
          ?.classList
          .add(
            "hidden"
          );


        $("forgotScreen")
          ?.classList
          .remove(
            "hidden"
          );
      }
    );


  $("backToLoginBtn")
    ?.addEventListener(
      "click",
      () => {

        $("forgotScreen")
          ?.classList
          .add(
            "hidden"
          );


        $("loginScreen")
          ?.classList
          .remove(
            "hidden"
          );
      }
    );


  $("forgotForm")
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const email =
          $("forgotEmail")
            .value
            .trim();


        if (!email) {

          showMessage(
            $("forgotMessage"),
            "أدخل البريد الإلكتروني.",
            "error"
          );

          return;
        }


        try {

          const {
            error
          } =
            await supabaseClient
              .auth
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
            $("forgotMessage"),
            "تم إرسال رابط الاستعادة إذا كان الحساب موجوداً.",
            "success"
          );

        } catch (error) {

          console.error(
            error
          );


          showMessage(
            $("forgotMessage"),
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
      async event => {

        event.preventDefault();


        const password =
          $("newPassword")
            .value;


        const confirm =
          $("confirmPassword")
            .value;


        if (
          !password ||
          !confirm
        ) {

          showMessage(
            $("resetMessage"),
            "أدخل كلمة المرور.",
            "error"
          );

          return;
        }


        if (
          password !==
          confirm
        ) {

          showMessage(
            $("resetMessage"),
            "كلمتا المرور غير متطابقتين.",
            "error"
          );

          return;
        }


        try {

          const {
            error
          } =
            await supabaseClient
              .auth
              .updateUser({
                password
              });


          if (error) {
            throw error;
          }


          showMessage(
            $("resetMessage"),
            "تم تغيير كلمة المرور بنجاح.",
            "success"
          );

        } catch (error) {

          console.error(
            error
          );


          showMessage(
            $("resetMessage"),
            error.message ||
            "تعذر تغيير كلمة المرور.",
            "error"
          );
        }

      }
    );
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

  await supabaseClient.auth
    .signOut();


  currentUser =
    null;

  currentProfile =
    null;

  currentRole =
    null;


  $("app")
    ?.classList
    .add(
      "hidden"
    );


  $("loginScreen")
    ?.classList
    .remove(
      "hidden"
    );
}


/* =========================================================
   AUTH LISTENER
========================================================= */

function setupAuthListener() {

  supabaseClient.auth
    .onAuthStateChange(
      async (
        event,
        session
      ) => {

        console.log(
          "DAWAMI1 Auth:",
          event
        );


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

  console.log(
    "DAWAMI1 initializing..."
  );


  /*
    IMPORTANT:
    If QR URL exists, handle it BEFORE
    rendering the normal login.
  */

  const handledQr =
    await checkQrUrlLogin();


  if (handledQr) {
    return;
  }


  setupNavigation();

  setupEmployeeForm();

  setupLeaveForm();

  setupForgotPassword();

  setupResetPassword();


  $("loginForm")
    ?.addEventListener(
      "submit",
      handleLogin
    );


  $("attendanceButton")
    ?.addEventListener(
      "click",
      handleAttendanceButton
    );


  $("breakButton")
    ?.addEventListener(
      "click",
      handleBreakButton
    );


  $("logoutBtn")
    ?.addEventListener(
      "click",
      logout
    );


  $("scanEmployeeQrBtn")
    ?.addEventListener(
      "click",
      startQrScanner
    );


  try {

    const {
      data
    } =
      await supabaseClient.auth
        .getSession();


    const session =
      data?.session;


    if (
      session?.user
    ) {

      currentUser =
        session.user;


      await loadApplication();

    } else {

      $("app")
        ?.classList
        .add(
          "hidden"
        );


      $("loginScreen")
        ?.classList
        .remove(
          "hidden"
        );
    }

  } catch (error) {

    console.error(
      "Session initialization:",
      error
    );
  }


  console.log(
    "DAWAMI1 initialized."
  );
}


/* =========================================================
   QR SCANNER
========================================================= */

async function startQrScanner() {

  const message =
    $("employeeQrMessage");


  try {

    if (
      !window.Html5Qrcode
    ) {

      throw new Error(
        "مكتبة QR Scanner غير محملة."
      );
    }


    if (
      qrScanner
    ) {

      try {
        await qrScanner.stop();
      } catch (_) {}

      qrScanner =
        null;
    }


    qrScanner =
      new Html5Qrcode(
        "qrReader"
      );


    await qrScanner.start(

      {
        facingMode:
          "environment"
      },

      {
        fps:
          10,

        qrbox: {
          width:
            240,

          height:
            240
        }
      },

      async decodedText => {

        try {

          await qrScanner.stop();

        } catch (_) {}


        qrScanner =
          null;


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
      "تعذر تشغيل الكاميرا. تأكد من إعطاء المتصفح صلاحية الكاميرا.",
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
      String(
        value ||
        ""
      ).trim();


    /*
      QR can contain:

      https://website.com/?employee_code=ABC

      OR:

      ABC
    */

    try {

      const url =
        new URL(
          code
        );


      const qrCode =
        url.searchParams.get(
          "employee_code"
        );


      if (qrCode) {

        code =
          qrCode.trim();
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
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

} else {

  init();

}
