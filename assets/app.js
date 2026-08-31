```javascript
/* =====================================================
   DAWAMI
   Employee Attendance & Payroll System

   FINAL VERSION
   Employee Login = National ID
   Employee Initial Password = National ID

   Admin:
   - Manage employees
   - Edit attendance
   - Review leaves

   Employee:
   - View own data
   - Clock in
   - Clock out
   - View attendance
   - Request leave

   IMPORTANT:
   Never put SUPABASE_SERVICE_ROLE_KEY here.
===================================================== */


/* =====================================================
   CONFIG
===================================================== */

const config =
  window.WORKTRACK_CONFIG;

if (!config) {
  throw new Error(
    "ملف config.js غير موجود."
  );
}

if (
  !window.supabase ||
  !window.supabase.createClient
) {
  throw new Error(
    "مكتبة Supabase لم يتم تحميلها."
  );
}


const supabaseClient =
  window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_KEY
  );


let currentUser = null;
let currentProfile = null;

let recoveryMode = false;
let recoveryHandled = false;


/* =====================================================
   HELPERS
===================================================== */

function $(id) {
  return document.getElementById(id);
}


function formatMoney(amount) {

  return "₪" +
    Number(
      amount || 0
    ).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    );
}


function formatMinutes(minutes) {

  minutes =
    Math.max(
      0,
      Math.round(
        Number(
          minutes || 0
        )
      )
    );

  const hours =
    Math.floor(
      minutes / 60
    );

  const mins =
    minutes % 60;

  return `${hours}:${String(
    mins
  ).padStart(2, "0")}`;
}


function getToday() {

  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatTime(date) {

  if (!date) {
    return "—";
  }

  return new Date(
    date
  ).toLocaleTimeString(
    "ar",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


function formatTimeForInput(date) {

  if (!date) {
    return "";
  }

  const d =
    new Date(date);

  const pad =
    n =>
      String(n)
        .padStart(2, "0");

  return `${pad(
    d.getHours()
  )}:${pad(
    d.getMinutes()
  )}`;
}


function buildTimestamp(
  date,
  time
) {

  if (
    !date ||
    !time
  ) {
    return null;
  }

  const parts =
    time
      .split(":")
      .map(Number);

  const hours =
    parts[0];

  const minutes =
    parts[1];

  const d =
    new Date(
      `${date}T00:00:00`
    );

  d.setHours(
    hours,
    minutes,
    0,
    0
  );

  return d.toISOString();
}


function getMonthStart() {

  const now =
    new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-01`;
}


function getMonthEnd() {

  const now =
    new Date();

  const lastDay =
    new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    );

  return `${lastDay.getFullYear()}-${String(
    lastDay.getMonth() + 1
  ).padStart(2, "0")}-${String(
    lastDay.getDate()
  ).padStart(2, "0")}`;
}


function isAdmin() {

  return (
    currentProfile?.role ===
    "admin"
  );
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


/* =====================================================
   PASSWORD RECOVERY
===================================================== */

function isRecoveryUrl() {

  const hash =
    window.location.hash ||
    "";

  const search =
    window.location.search ||
    "";

  return (
    hash.includes(
      "type=recovery"
    ) ||
    search.includes(
      "type=recovery"
    ) ||
    new URLSearchParams(
      search
    ).has("code")
  );
}


function showLogin() {

  $("loginScreen")
    ?.classList
    .remove("hidden");

  $("forgotScreen")
    ?.classList
    .add("hidden");

  $("resetScreen")
    ?.classList
    .add("hidden");

  $("app")
    ?.classList
    .add("hidden");
}


function showForgotPassword() {

  $("loginScreen")
    ?.classList
    .add("hidden");

  $("forgotScreen")
    ?.classList
    .remove("hidden");

  $("resetScreen")
    ?.classList
    .add("hidden");

  $("app")
    ?.classList
    .add("hidden");
}


function showResetPassword() {

  $("loginScreen")
    ?.classList
    .add("hidden");

  $("forgotScreen")
    ?.classList
    .add("hidden");

  $("resetScreen")
    ?.classList
    .remove("hidden");

  $("app")
    ?.classList
    .add("hidden");
}


function showApp() {

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
}


/* =====================================================
   PASSWORD RESET
===================================================== */

async function sendPasswordReset(
  email
) {

  const redirectUrl =
    window.location.origin +
    window.location.pathname;

  const {
    error
  } =
    await supabaseClient
      .auth
      .resetPasswordForEmail(
        email,
        {
          redirectTo:
            redirectUrl
        }
      );

  if (error) {
    throw error;
  }
}


async function updatePassword(
  password
) {

  const {
    data,
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

  return data;
}


async function handleResetPassword(
  event
) {

  event.preventDefault();

  const password =
    $("newPassword")
      ?.value || "";

  const confirm =
    $("confirmPassword")
      ?.value || "";

  const message =
    $("resetMessage");

  if (!message) {
    return;
  }

  message.style.color =
    "var(--danger)";

  if (
    password.length < 6
  ) {

    message.textContent =
      "كلمة المرور يجب أن تكون 6 أحرف على الأقل.";

    return;
  }

  if (
    password !== confirm
  ) {

    message.textContent =
      "كلمتا المرور غير متطابقتين.";

    return;
  }

  try {

    message.style.color =
      "var(--success)";

    message.textContent =
      "جاري حفظ كلمة المرور...";

    const {
      data
    } =
      await supabaseClient
        .auth
        .getSession();

    if (
      !data?.session
    ) {

      throw new Error(
        "انتهت جلسة استعادة كلمة المرور."
      );

    }

    await updatePassword(
      password
    );

    message.textContent =
      "تم تغيير كلمة المرور بنجاح.";

    $("resetForm")
      ?.reset();

    recoveryMode = false;
    recoveryHandled = true;

    await supabaseClient
      .auth
      .signOut();

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    setTimeout(
      () => {

        showLogin();

        if (
          $("loginMessage")
        ) {

          $("loginMessage")
            .style
            .color =
              "var(--success)";

          $("loginMessage")
            .textContent =
              "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.";

        }

      },
      500
    );

  } catch (error) {

    console.error(
      "PASSWORD RESET ERROR:",
      error
    );

    message.style.color =
      "var(--danger)";

    message.textContent =
      error?.message ||
      "تعذر تغيير كلمة المرور.";
  }
}


/* =====================================================
   LOGIN
===================================================== */

/*
  Employee enters:
    National ID
    Password

  Internally:
    National ID becomes:
    NATIONAL_ID@dawami.local
*/

function buildAuthEmail(
  nationalId
) {

  return `${String(
    nationalId
  ).trim()}@dawami.local`;
}


async function login(
  nationalId,
  password
) {

  const authEmail =
    buildAuthEmail(
      nationalId
    );

  console.log(
    "LOGIN START:",
    nationalId
  );

  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .signInWithPassword({

        email:
          authEmail,

        password:
          password

      });

  if (error) {
    throw error;
  }

  if (
    !data?.user
  ) {

    throw new Error(
      "لم يتم العثور على حساب المستخدم."
    );

  }

  currentUser =
    data.user;

  await loadProfile();

  setupAdminUI();

  await loadDashboard();

  await loadLeaves();

  if (
    isAdmin()
  ) {

    await loadEmployees();

    await loadAdminAttendance();

    await loadAdminLeaves();

  }

  showApp();
}


/* =====================================================
   PROFILE
===================================================== */

async function loadProfile() {

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
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {

    throw new Error(
      "تم تسجيل الدخول، لكن لا يوجد ملف موظف مرتبط بهذا الحساب."
    );

  }

  currentProfile =
    data;

  if (
    $("welcomeText")
  ) {

    $("welcomeText")
      .textContent =
      `مرحباً ${
        data.full_name ||
        "بك"
      }`;

  }

  if (
    $("baseSalary")
  ) {

    $("baseSalary")
      .textContent =
      formatMoney(
        data.monthly_salary
      );

  }
}


/* =====================================================
   ADMIN UI
===================================================== */

function setupAdminUI() {

  const admin =
    isAdmin();

  [
    "adminEmployeesNav",
    "adminAttendanceNav",
    "adminLeavesNav"
  ]
    .forEach(
      id => {

        const element =
          $(id);

        if (!element) {
          return;
        }

        if (admin) {
          element.classList
            .remove("hidden");
        } else {
          element.classList
            .add("hidden");
        }

      }
    );
}


/* =====================================================
   ATTENDANCE
===================================================== */

async function getTodayAttendanceForEmployee(
  employeeId =
    currentUser.id
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq(
        "employee_id",
        employeeId
      )
      .eq(
        "work_date",
        getToday()
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      )
      .limit(1)
      .maybeSingle();

  if (error) {

    console.error(
      "GET TODAY ATTENDANCE ERROR:",
      error
    );

    return null;
  }

  return data;
}


async function getTodayAttendance() {

  return getTodayAttendanceForEmployee(
    currentUser.id
  );
}


/*
  Employee cannot insert attendance directly.
*/

async function clockIn() {

  const {
    data,
    error
  } =
    await supabaseClient
      .rpc(
        "clock_in"
      );

  if (error) {
    throw error;
  }

  return data;
}


/*
  Employee cannot update attendance directly.
*/

async function clockOut() {

  const {
    data,
    error
  } =
    await supabaseClient
      .rpc(
        "clock_out"
      );

  if (error) {
    throw error;
  }

  return data;
}


async function handleAttendance() {

  const button =
    $("attendanceButton");

  if (!button) {
    return;
  }

  button.disabled =
    true;

  try {

    const attendance =
      await getTodayAttendance();

    if (
      !attendance ||
      !attendance.clock_in
    ) {

      await clockIn();

      alert(
        "تم تسجيل الحضور بنجاح."
      );

    } else if (
      attendance.clock_in &&
      !attendance.clock_out
    ) {

      await clockOut();

      alert(
        "تم تسجيل الانصراف وحساب ساعات الدوام."
      );

    }

    await loadDashboard();

  } catch (error) {

    console.error(
      "ATTENDANCE ERROR:",
      error
    );

    alert(
      error?.message ||
      "حدث خطأ أثناء تسجيل الدوام."
    );

  } finally {

    button.disabled =
      false;

  }
}


/* =====================================================
   LOAD ATTENDANCE
===================================================== */

async function loadAttendance(
  employeeId =
    currentUser.id
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq(
        "employee_id",
        employeeId
      )
      .order(
        "work_date",
        {
          ascending:
            false
        }
      );

  if (error) {

    console.error(
      "LOAD ATTENDANCE ERROR:",
      error
    );

    return [];
  }

  return data || [];
}


/* =====================================================
   ATTENDANCE RENDER
===================================================== */

function renderAttendance(
  records,
  element
) {

  if (!element) {
    return;
  }

  if (
    !records.length
  ) {

    element.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          لا توجد سجلات دوام بعد.
        </td>
      </tr>
    `;

    return;
  }

  element.innerHTML =
    records
      .map(
        row => {

          let statusText =
            "مراجعة";

          if (
            row.status ===
            "complete"
          ) {
            statusText =
              "مكتمل";
          }

          if (
            row.status ===
            "open"
          ) {
            statusText =
              "مفتوح";
          }

          return `
            <tr>

              <td>
                ${escapeHtml(
                  row.work_date
                )}
              </td>

              <td>
                ${
                  row.clock_in
                    ? formatTime(
                        row.clock_in
                      )
                    : "—"
                }
              </td>

              <td>
                ${
                  row.clock_out
                    ? formatTime(
                        row.clock_out
                      )
                    : "—"
                }
              </td>

              <td>
                ${formatMinutes(
                  row.regular_minutes
                )}
              </td>

              <td>
                ${
                  Number(
                    row.overtime_minutes ||
                    0
                  ) > 0
                    ? formatMinutes(
                        row.overtime_minutes
                      )
                    : "—"
                }
              </td>

              <td>
                <span class="pill">
                  ${statusText}
                </span>
              </td>

            </tr>
          `;
        }
      )
      .join("");
}


/* =====================================================
   HOLIDAY PAY
===================================================== */

async function calculateHolidayPay() {

  const {
    data: holidays,
    error
  } =
    await supabaseClient
      .from("holidays")
      .select("*")
      .order(
        "holiday_date",
        {
          ascending:
            true
        }
      );

  if (error) {

    console.error(
      "HOLIDAYS ERROR:",
      error
    );

    return {
      hours: 0,
      amount: 0
    };
  }

  if (
    !holidays?.length
  ) {

    return {
      hours: 0,
      amount: 0
    };
  }

  const attendance =
    await loadAttendance();

  const hourlyRate =
    Number(
      currentProfile
        ?.monthly_salary ||
        0
    ) /
    (
      (
        Number(
          currentProfile
            ?.work_days_per_week ||
          6
        ) *
        52 /
        12
      ) *
      Number(
        currentProfile
          ?.work_hours_per_day ||
        8
      )
    );

  let totalAmount =
    0;

  let totalHours =
    0;

  for (
    const holiday of holidays
  ) {

    const worked =
      attendance.find(
        row =>
          row.work_date ===
          holiday.holiday_date
      );

    if (
      Number(
        holiday.day_number
      ) === 1
    ) {

      totalHours +=
        8;

      totalAmount +=
        8 *
        hourlyRate;

      continue;
    }

    if (
      worked &&
      worked.clock_in &&
      worked.clock_out
    ) {

      const minutes =
        Number(
          worked.regular_minutes ||
          0
        );

      const hours =
        minutes / 60;

      totalHours +=
        hours;

      totalAmount +=
        hours *
        hourlyRate *
        1.5;

    }
  }

  return {
    hours:
      totalHours,

    amount:
      totalAmount
  };
}


/* =====================================================
   DEDUCTIONS
===================================================== */

async function calculateDeductions() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("deductions")
      .select("amount")
      .eq(
        "employee_id",
        currentUser.id
      )
      .eq(
        "status",
        "approved"
      );

  if (error) {

    console.error(
      "DEDUCTIONS ERROR:",
      error
    );

    return 0;
  }

  return (
    data || []
  )
    .reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.amount ||
          0
        ),
      0
    );
}


/* =====================================================
   PAYROLL
===================================================== */

async function calculatePayroll() {

  if (!currentProfile) {
    return;
  }

  const baseSalary =
    Number(
      currentProfile
        .monthly_salary ||
      0
    );

  const holiday =
    await calculateHolidayPay();

  const deductions =
    await calculateDeductions();

  const expected =
    baseSalary +
    holiday.amount -
    deductions;

  if (
    $("baseSalary")
  ) {

    $("baseSalary")
      .textContent =
      formatMoney(
        baseSalary
      );

  }

  if (
    $("overtimePay")
  ) {

    $("overtimePay")
      .textContent =
      formatMoney(
        holiday.amount
      );

  }

  if (
    $("deductions")
  ) {

    $("deductions")
      .textContent =
      formatMoney(
        deductions
      );

  }

  if (
    $("totalSalary")
  ) {

    $("totalSalary")
      .textContent =
      formatMoney(
        expected
      );

  }

  if (
    $("expectedSalary")
  ) {

    $("expectedSalary")
      .textContent =
      formatMoney(
        expected
      );

  }

  if (
    $("overtimeHours")
  ) {

    $("overtimeHours")
      .textContent =
      formatMinutes(
        Math.round(
          holiday.hours *
          60
        )
      );

  }
}


/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {

  if (!currentUser) {
    return;
  }

  const attendance =
    await loadAttendance();

  const monthStart =
    getMonthStart();

  const monthEnd =
    getMonthEnd();

  const monthRecords =
    attendance.filter(
      row =>
        row.work_date >=
          monthStart &&
        row.work_date <=
          monthEnd
    );

  let totalMinutes =
    0;

  monthRecords.forEach(
    row => {

      totalMinutes +=
        Number(
          row.regular_minutes ||
          0
        );

    }
  );

  if (
    $("monthlyHours")
  ) {

    $("monthlyHours")
      .textContent =
      formatMinutes(
        totalMinutes
      );

  }

  const today =
    await getTodayAttendance();

  if (!today) {

    if (
      $("todayStatus")
    ) {

      $("todayStatus")
        .textContent =
        "لم تسجل حضورك";

    }

    if (
      $("todayMessage")
    ) {

      $("todayMessage")
        .textContent =
        "اضغط على الزر لتسجيل بداية الدوام.";

    }

    if (
      $("attendanceButton")
    ) {

      $("attendanceButton")
        .textContent =
        "تسجيل حضور";

    }

  } else if (
    today.clock_in &&
    !today.clock_out
  ) {

    $("todayStatus")
      .textContent =
      "أنت على رأس العمل";

    $("todayMessage")
      .textContent =
      `بدأت الساعة ${
        formatTime(
          today.clock_in
        )
      }`;

    $("attendanceButton")
      .textContent =
      "تسجيل انصراف";

  } else {

    $("todayStatus")
      .textContent =
      "انتهى دوام اليوم";

    $("todayMessage")
      .textContent =
      `الحضور ${
        formatTime(
          today.clock_in
        )
      } • الانصراف ${
        formatTime(
          today.clock_out
        )
      }`;

    $("attendanceButton")
      .textContent =
      "تسجيل حضور";
  }


  const hasError =
    attendance.some(
      row =>
        row.status ===
          "missing_clock_in" ||
        row.status ===
          "missing_clock_out"
    );


  if (
    $("attendanceAlert")
  ) {

    $("attendanceAlert")
      .textContent =
      hasError
        ? "يوجد خطأ"
        : "سليم";

    $("attendanceAlert")
      .className =
      hasError
        ? "card-value bad"
        : "card-value success";
  }


  renderAttendance(
    attendance.slice(
      0,
      10
    ),
    $("recentAttendance")
  );


  renderAttendance(
    attendance,
    $("allAttendance")
  );


  await calculatePayroll();
}


/* =====================================================
   LEAVES
===================================================== */

async function loadLeaves() {

  if (!currentUser) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("leave_requests")
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
      "LEAVES ERROR:",
      error
    );

    return;
  }

  const leaves =
    data || [];

  const used =
    leaves
      .filter(
        leave =>
          leave.status ===
          "approved"
      )
      .reduce(
        (
          sum,
          leave
        ) =>
          sum +
          Number(
            leave.total_days ||
            0
          ),
        0
      );

  const available =
    18;

  const remaining =
    Math.max(
      0,
      available -
        used
    );


  if (
    $("leaveAvailable")
  ) {

    $("leaveAvailable")
      .textContent =
      available;

  }

  if (
    $("leaveUsed")
  ) {

    $("leaveUsed")
      .textContent =
      used;

  }

  if (
    $("leaveRemaining")
  ) {

    $("leaveRemaining")
      .textContent =
      remaining;

  }


  if (
    !leaves.length
  ) {

    if (
      $("leaveList")
    ) {

      $("leaveList")
        .innerHTML =
        "<p>لا توجد طلبات إجازة.</p>";

    }

    return;
  }


  if (
    $("leaveList")
  ) {

    $("leaveList")
      .innerHTML =
      leaves
        .map(
          leave => {

            let status =
              "قيد المراجعة";

            if (
              leave.status ===
              "approved"
            ) {
              status =
                "مقبولة";
            }

            if (
              leave.status ===
              "rejected"
            ) {
              status =
                "مرفوضة";
            }

            return `
              <div class="leave-item">

                <strong>
                  ${escapeHtml(
                    leave.start_date
                  )}
                  →
                  ${escapeHtml(
                    leave.end_date
                  )}
                </strong>

                <span>
                  ${
                    Number(
                      leave.total_days ||
                      0
                    )
                  }
                  يوم • ${status}
                </span>

              </div>
            `;

          }
        )
        .join("");

  }
}


/* =====================================================
   CREATE LEAVE
===================================================== */

async function createLeaveRequest(
  event
) {

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

  const startDate =
    new Date(
      `${start}T00:00:00`
    );

  const endDate =
    new Date(
      `${end}T00:00:00`
    );

  const days =
    Math.round(
      (
        endDate -
        startDate
      ) / 86400000
    ) + 1;


  if (
    !start ||
    !end ||
    days <= 0
  ) {

    alert(
      "تاريخ الإجازة غير صحيح."
    );

    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("leave_requests")
      .insert({

        employee_id:
          currentUser.id,

        start_date:
          start,

        end_date:
          end,

        total_days:
          days,

        reason:
          reason,

        status:
          "pending"

      });


  if (error) {

    alert(
      error.message
    );

    return;
  }


  $("leaveForm")
    ?.reset();

  await loadLeaves();

  alert(
    "تم إرسال طلب الإجازة بنجاح."
  );
}


/* =====================================================
   ADMIN - EMPLOYEES
===================================================== */

async function loadEmployees() {

  if (!isAdmin()) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .order(
        "full_name",
        {
          ascending:
            true
        }
      );


  if (error) {

    console.error(
      "LOAD EMPLOYEES ERROR:",
      error
    );

    alert(
      "تعذر تحميل الموظفين: " +
      error.message
    );

    return;
  }


  renderEmployees(
    data || []
  );
}


/* =====================================================
   RENDER EMPLOYEES
===================================================== */

function renderEmployees(
  employees
) {

  const table =
    $("employeesTable");

  if (!table) {
    return;
  }


  if (
    !employees.length
  ) {

    table.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          لا يوجد موظفون.
        </td>
      </tr>
    `;

    return;
  }


  table.innerHTML =
    employees
      .map(
        employee => {

          const active =
            employee.is_active !==
            false;


          return `
            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    employee.full_name ||
                    "—"
                  )}
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  employee.national_id ||
                  "—"
                )}
              </td>

              <td>
                ${escapeHtml(
                  employee.phone ||
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
                ${formatMoney(
                  employee.monthly_salary
                )}
              </td>

              <td>
                ${
                  Number(
                    employee.work_hours_per_day ||
                    8
                  )
                }
              </td>

              <td>
                ${
                  Number(
                    employee.work_days_per_week ||
                    6
                  )
                }
              </td>

              <td>

                <span class="pill ${
                  active
                    ? "success"
                    : "bad"
                }">

                  ${
                    active
                      ? "نشط"
                      : "غير نشط"
                  }

                </span>

              </td>

              <td>

                <button
                  class="secondary-button"
                  onclick="editEmployee('${employee.id}')"
                >
                  تعديل
                </button>

              </td>

            </tr>
          `;

        }
      )
      .join("");
}


/* =====================================================
   EMPLOYEE FORM
===================================================== */

function openEmployeeForm(
  employee = null
) {

  $("employeeForm")
    ?.classList
    .remove("hidden");


  $("employeeId").value =
    employee?.id || "";


  $("employeeName").value =
    employee?.full_name || "";


  /*
    NEW:
    National ID instead of email
  */

  if (
    $("employeeNationalId")
  ) {

    $("employeeNationalId")
      .value =
      employee?.national_id ||
      "";

  }


  $("employeePhone").value =
    employee?.phone || "";


  $("employeeNumber").value =
    employee?.employee_number ||
    "";


  $("employeeDepartment").value =
    employee?.department ||
    "";


  $("employeeJobTitle").value =
    employee?.job_title ||
    "";


  $("employeeSalary").value =
    employee?.monthly_salary ??
    "";


  $("employeeHours").value =
    employee?.work_hours_per_day ??
    8;


  $("employeeDays").value =
    employee?.work_days_per_week ??
    6;
}


/* =====================================================
   EDIT EMPLOYEE
===================================================== */

async function editEmployee(
  id
) {

  if (!isAdmin()) {

    alert(
      "ليس لديك صلاحية."
    );

    return;
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
        id
      )
      .maybeSingle();


  if (
    error ||
    !data
  ) {

    alert(
      "تعذر تحميل بيانات الموظف."
    );

    return;
  }


  openEmployeeForm(
    data
  );
}


/* =====================================================
   CREATE EMPLOYEE THROUGH EDGE FUNCTION
===================================================== */

async function createEmployee(
  employee
) {

  const {
    data: sessionData,
    error: sessionError
  } =
    await supabaseClient
      .auth
      .getSession();


  if (
    sessionError ||
    !sessionData?.session
  ) {

    throw new Error(
      "انتهت جلسة الدخول. سجلي الدخول من جديد."
    );

  }


  const {
    data,
    error
  } =
    await supabaseClient
      .functions
      .invoke(
        "create-employee",
        {
          body:
            employee
        }
      );


  if (error) {

    console.error(
      "CREATE EMPLOYEE FUNCTION ERROR:",
      error
    );

    /*
      Sometimes the Edge Function returns
      its message in the response body.
    */

    let message =
      error.message ||
      "تعذر إنشاء الموظف.";

    try {

      if (
        error.context
      ) {

        const response =
          error.context;

        const body =
          await response.json();

        if (
          body?.error
        ) {

          message =
            body.error;

        }

      }

    } catch (_) {
      /* ignore */
    }


    throw new Error(
      message
    );
  }


  if (
    data?.error
  ) {

    throw new Error(
      data.error
    );

  }


  return data;
}


/* =====================================================
   SAVE EMPLOYEE
===================================================== */

async function saveEmployee(
  event
) {

  event.preventDefault();


  if (!isAdmin()) {

    alert(
      "ليس لديك صلاحية."
    );

    return;
  }


  const id =
    $("employeeId")
      .value
      .trim();


  const employee = {

    full_name:
      $("employeeName")
        .value
        .trim(),

    national_id:
      $("employeeNationalId")
        .value
        .trim(),

    phone:
      $("employeePhone")
        .value
        .trim(),

    employee_number:
      $("employeeNumber")
        .value
        .trim() ||
      null,

    department:
      $("employeeDepartment")
        .value
        .trim() ||
      null,

    job_title:
      $("employeeJobTitle")
        .value
        .trim() ||
      null,

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


  /* ---------------------------------------------
     VALIDATION
  --------------------------------------------- */

  if (
    !employee.full_name
  ) {

    alert(
      "اكتبي اسم الموظف."
    );

    return;
  }


  if (
    !employee.national_id
  ) {

    alert(
      "اكتبي رقم هوية الموظف."
    );

    return;
  }


  if (
    employee.national_id.length <
    5
  ) {

    alert(
      "رقم الهوية غير صحيح."
    );

    return;
  }


  /* ---------------------------------------------
     NEW EMPLOYEE
  --------------------------------------------- */

  if (!id) {

    const button =
      $("saveEmployeeButton");

    if (button) {
      button.disabled =
        true;
    }


    try {

      const result =
        await createEmployee(
          employee
        );


      /*
        Show credentials once.
      */

      alert(
        `تم إنشاء حساب الموظف بنجاح.

اسم الدخول:
${employee.national_id}

كلمة المرور الأولية:
${employee.national_id}

يجب إعطاء الموظف هذه البيانات.`
      );


      $("employeeForm")
        ?.reset();

      $("employeeId")
        .value = "";


      $("employeeForm")
        ?.classList
        .add("hidden");


      await loadEmployees();


    } catch (error) {

      console.error(
        "CREATE EMPLOYEE ERROR:",
        error
      );

      alert(
        error?.message ||
        "تعذر إنشاء حساب الموظف."
      );

    } finally {

      if (button) {
        button.disabled =
          false;
      }

    }

    return;
  }


  /* ---------------------------------------------
     EXISTING EMPLOYEE
     Admin can update profile.
  --------------------------------------------- */

  const {
    error
  } =
    await supabaseClient
      .from("profiles")
      .update({

        full_name:
          employee.full_name,

        national_id:
          employee.national_id,

        phone:
          employee.phone,

        employee_number:
          employee.employee_number,

        department:
          employee.department,

        job_title:
          employee.job_title,

        monthly_salary:
          employee.monthly_salary,

        work_hours_per_day:
          employee.work_hours_per_day,

        work_days_per_week:
          employee.work_days_per_week,

        updated_at:
          new Date()
            .toISOString()

      })
      .eq(
        "id",
        id
      );


  if (error) {

    console.error(
      "UPDATE EMPLOYEE ERROR:",
      error
    );

    alert(
      "تعذر حفظ بيانات الموظف: " +
      error.message
    );

    return;
  }


  $("employeeForm")
    ?.reset();

  $("employeeId")
    .value = "";


  $("employeeForm")
    ?.classList
    .add("hidden");


  await loadEmployees();


  alert(
    "تم تحديث بيانات الموظف."
  );
}


/* =====================================================
   ADMIN ATTENDANCE
===================================================== */

async function loadAdminAttendance() {

  if (!isAdmin()) {
    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("attendance")
      .select(`
        *,
        profiles:employee_id (
          full_name,
          national_id,
          phone
        )
      `)
      .order(
        "work_date",
        {
          ascending:
            false
        }
      );


  if (error) {

    console.error(
      "ADMIN ATTENDANCE ERROR:",
      error
    );

    alert(
      "تعذر تحميل الدوام: " +
      error.message
    );

    return;
  }


  renderAdminAttendance(
    data || []
  );
}


/* =====================================================
   ADMIN ATTENDANCE RENDER
===================================================== */

function renderAdminAttendance(
  records
) {

  const table =
    $("adminAttendanceTable");

  if (!table) {
    return;
  }


  if (
    !records.length
  ) {

    table.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          لا توجد سجلات دوام.
        </td>
      </tr>
    `;

    return;
  }


  table.innerHTML =
    records
      .map(
        row => {

          const employeeName =
            row.profiles
              ?.full_name ||
            row.profiles
              ?.national_id ||
            row.employee_id;


          return `
            <tr>

              <td>
                ${escapeHtml(
                  employeeName
                )}
              </td>

              <td>
                ${escapeHtml(
                  row.work_date
                )}
              </td>

              <td>
                ${
                  row.clock_in
                    ? formatTime(
                        row.clock_in
                      )
                    : "—"
                }
              </td>

              <td>
                ${
                  row.clock_out
                    ? formatTime(
                        row.clock_out
                      )
                    : "—"
                }
              </td>

              <td>
                ${formatMinutes(
                  row.regular_minutes
                )}
              </td>

              <td>
                ${formatMinutes(
                  row.overtime_minutes
                )}
              </td>

              <td>
                <span class="pill">
                  ${escapeHtml(
                    row.status ||
                    "—"
                  )}
                </span>
              </td>

              <td>

                <button
                  class="secondary-button"
                  onclick="editAttendance('${row.id}')"
                >
                  تعديل
                </button>

              </td>

            </tr>
          `;

        }
      )
      .join("");
}


/* =====================================================
   EDIT ATTENDANCE
===================================================== */

async function editAttendance(
  attendanceId
) {

  if (!isAdmin()) {

    alert(
      "ليس لديك صلاحية."
    );

    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("attendance")
      .select(`
        *,
        profiles:employee_id (
          full_name,
          national_id
        )
      `)
      .eq(
        "id",
        attendanceId
      )
      .single();


  if (error) {

    alert(
      error.message
    );

    return;
  }


  const employeeName =
    data.profiles
      ?.full_name ||
    data.profiles
      ?.national_id ||
    data.employee_id;


  const newDate =
    prompt(
      `تاريخ الدوام للموظف ${employeeName}
التاريخ الحالي: ${data.work_date}
أدخل التاريخ YYYY-MM-DD:`,
      data.work_date
    );


  if (
    newDate === null
  ) {
    return;
  }


  const newClockIn =
    prompt(
      "وقت الحضور HH:MM أو اتركه فارغاً:",
      data.clock_in
        ? formatTimeForInput(
            data.clock_in
          )
        : ""
    );


  if (
    newClockIn === null
  ) {
    return;
  }


  const newClockOut =
    prompt(
      "وقت الانصراف HH:MM أو اتركه فارغاً:",
      data.clock_out
        ? formatTimeForInput(
            data.clock_out
          )
        : ""
    );


  if (
    newClockOut === null
  ) {
    return;
  }


  const newRegular =
    prompt(
      "الساعات العادية بالدقائق:",
      data.regular_minutes ||
      0
    );


  if (
    newRegular === null
  ) {
    return;
  }


  const newOvertime =
    prompt(
      "الإضافي بالدقائق:",
      data.overtime_minutes ||
      0
    );


  if (
    newOvertime === null
  ) {
    return;
  }


  const payload = {

    work_date:
      newDate,

    clock_in:
      buildTimestamp(
        newDate,
        newClockIn
      ),

    clock_out:
      buildTimestamp(
        newDate,
        newClockOut
      ),

    regular_minutes:
      Number(
        newRegular ||
        0
      ),

    overtime_minutes:
      Number(
        newOvertime ||
        0
      ),

    status:
      newClockIn &&
      newClockOut
        ? "complete"
        : newClockIn
        ? "open"
        : "missing_clock_in",

    updated_at:
      new Date()
        .toISOString()

  };


  const {
    error:
      updateError
  } =
    await supabaseClient
      .from("attendance")
      .update(
        payload
      )
      .eq(
        "id",
        attendanceId
      );


  if (
    updateError
  ) {

    alert(
      updateError.message
    );

    return;
  }


  await loadAdminAttendance();

  await loadDashboard();


  alert(
    "تم تعديل سجل الدوام."
  );
}


/* =====================================================
   ADMIN LEAVES
===================================================== */

async function loadAdminLeaves() {

  if (!isAdmin()) {
    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("leave_requests")
      .select(`
        *,
        profiles:employee_id (
          full_name,
          national_id,
          phone
        )
      `)
      .order(
        "created_at",
        {
          ascending:
            false
        }
      );


  if (error) {

    console.error(
      "ADMIN LEAVES ERROR:",
      error
    );

    alert(
      "تعذر تحميل طلبات الإجازات: " +
      error.message
    );

    return;
  }


  renderAdminLeaves(
    data || []
  );
}


/* =====================================================
   ADMIN LEAVES RENDER
===================================================== */

function renderAdminLeaves(
  leaves
) {

  const table =
    $("adminLeavesTable");

  if (!table) {
    return;
  }


  if (
    !leaves.length
  ) {

    table.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          لا توجد طلبات إجازة.
        </td>
      </tr>
    `;

    return;
  }


  table.innerHTML =
    leaves
      .map(
        leave => {

          const employee =
            leave.profiles
              ?.full_name ||
            leave.profiles
              ?.national_id ||
            leave.employee_id;


          let status =
            "قيد المراجعة";


          if (
            leave.status ===
            "approved"
          ) {
            status =
              "مقبولة";
          }


          if (
            leave.status ===
            "rejected"
          ) {
            status =
              "مرفوضة";
          }


          return `
            <tr>

              <td>
                ${escapeHtml(
                  employee
                )}
              </td>

              <td>
                ${escapeHtml(
                  leave.start_date
                )}
              </td>

              <td>
                ${escapeHtml(
                  leave.end_date
                )}
              </td>

              <td>
                ${
                  Number(
                    leave.total_days ||
                    0
                  )
                }
              </td>

              <td>
                ${escapeHtml(
                  leave.reason ||
                  "—"
                )}
              </td>

              <td>

                <span class="pill">
                  ${status}
                </span>

              </td>

              <td>

                ${
                  leave.status ===
                  "pending"

                    ? `
                      <button
                        class="secondary-button"
                        onclick="reviewLeave('${leave.id}', 'approved')"
                      >
                        قبول
                      </button>

                      <button
                        class="secondary-button"
                        onclick="reviewLeave('${leave.id}', 'rejected')"
                      >
                        رفض
                      </button>
                    `

                    : "—"
                }

              </td>

            </tr>
          `;

        }
      )
      .join("");
}


/* =====================================================
   REVIEW LEAVE
===================================================== */

async function reviewLeave(
  leaveId,
  status
) {

  if (!isAdmin()) {
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("leave_requests")
      .update({

        status:
          status,

        reviewed_by:
          currentUser.id,

        reviewed_at:
          new Date()
            .toISOString()

      })
      .eq(
        "id",
        leaveId
      );


  if (error) {

    alert(
      error.message
    );

    return;
  }


  await loadAdminLeaves();


  alert(
    status ===
      "approved"
      ? "تم قبول الإجازة."
      : "تم رفض الإجازة."
  );
}


/* =====================================================
   NAVIGATION
===================================================== */

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

            document
              .querySelectorAll(
                ".nav-btn"
              )
              .forEach(
                btn =>
                  btn.classList
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
                page =>
                  page.classList
                    .remove(
                      "active"
                    )
              );


            const page =
              $(
                button.dataset.page
              );


            if (page) {
              page.classList
                .add(
                  "active"
                );
            }


            if (
              button.dataset.page ===
              "employees"
            ) {

              await loadEmployees();

            }


            if (
              button.dataset.page ===
              "adminAttendance"
            ) {

              await loadAdminAttendance();

            }


            if (
              button.dataset.page ===
              "adminLeaves"
            ) {

              await loadAdminLeaves();

            }

          }
        );

      }
    );
}


/* =====================================================
   LOGOUT
===================================================== */

async function logout() {

  await supabaseClient
    .auth
    .signOut();


  currentUser =
    null;

  currentProfile =
    null;

  recoveryMode =
    false;

  recoveryHandled =
    false;


  window.history
    .replaceState(
      {},
      document.title,
      window.location.pathname
    );


  showLogin();
}


/* =====================================================
   EVENTS
===================================================== */

function setupEvents() {


  /* LOGIN */

  $("loginForm")
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        /*
          The login input should now contain
          NATIONAL ID instead of email.
        */

        const nationalId =
          $("nationalId")
            ?.value
            ?.trim() ||
          $("email")
            ?.value
            ?.trim();


        const password =
          $("password")
            ?.value ||
          "";


        const message =
          $("loginMessage");


        if (!nationalId) {

          message.textContent =
            "أدخلي رقم الهوية.";

          return;
        }


        message.style.color =
          "var(--danger)";

        message.textContent =
          "جاري تسجيل الدخول...";


        try {

          await login(
            nationalId,
            password
          );


          message.style.color =
            "var(--success)";

          message.textContent =
            "";


        } catch (error) {

          console.error(
            "LOGIN ERROR:",
            error
          );


          let errorMessage =
            error?.message ||
            "حدث خطأ أثناء تسجيل الدخول.";


          if (
            error?.message ===
            "Invalid login credentials"
          ) {

            errorMessage =
              "رقم الهوية أو كلمة المرور غير صحيحة.";

          }


          message.style.color =
            "var(--danger)";

          message.textContent =
            errorMessage;

        }

      }
    );


  /* FORGOT PASSWORD */

  $("forgotPasswordBtn")
    ?.addEventListener(
      "click",
      () => {

        /*
          For employee accounts created by
          this system, password recovery by
          email is not used because login
          identity is national ID.

          Keep this for admin / legacy accounts.
        */

        const email =
          $("email")
            ?.value
            ?.trim();


        if (
          email &&
          $("forgotEmail")
        ) {

          $("forgotEmail")
            .value =
            email;

        }


        showForgotPassword();

      }
    );


  /* BACK TO LOGIN */

  $("backToLoginBtn")
    ?.addEventListener(
      "click",
      () => {

        showLogin();

      }
    );


  /* SEND RESET */

  $("forgotForm")
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const email =
          $("forgotEmail")
            .value
            .trim();


        const message =
          $("forgotMessage");


        message.style.color =
          "var(--danger)";

        message.textContent =
          "جاري إرسال الرابط...";


        try {

          await sendPasswordReset(
            email
          );


          message.style.color =
            "var(--success)";

          message.textContent =
            "تم إرسال رابط تغيير كلمة المرور.";

        } catch (error) {

          console.error(
            "RESET EMAIL ERROR:",
            error
          );


          message.style.color =
            "var(--danger)";

          message.textContent =
            error?.message ||
            "تعذر إرسال رابط الاستعادة.";

        }

      }
    );


  /* RESET PASSWORD */

  $("resetForm")
    ?.addEventListener(
      "submit",
      handleResetPassword
    );


  /* ATTENDANCE */

  $("attendanceButton")
    ?.addEventListener(
      "click",
      handleAttendance
    );


  /* LEAVE */

  $("leaveForm")
    ?.addEventListener(
      "submit",
      createLeaveRequest
    );


  /* LOGOUT */

  $("logoutBtn")
    ?.addEventListener(
      "click",
      logout
    );


  /* ADD EMPLOYEE */

  $("showEmployeeForm")
    ?.addEventListener(
      "click",
      () => {

        $("employeeForm")
          ?.reset();


        $("employeeId")
          .value = "";


        $("employeeHours")
          .value = 8;


        $("employeeDays")
          .value = 6;


        $("employeeForm")
          ?.classList
          .remove(
            "hidden"
          );

      }
    );


  /* CANCEL */

  $("cancelEmployeeForm")
    ?.addEventListener(
      "click",
      () => {

        $("employeeForm")
          ?.reset();


        $("employeeId")
          .value = "";


        $("employeeForm")
          ?.classList
          .add(
            "hidden"
          );

      }
    );


  /* SAVE */

  $("employeeForm")
    ?.addEventListener(
      "submit",
      saveEmployee
    );
}


/* =====================================================
   AUTH STATE
===================================================== */

function setupAuthListener() {

  supabaseClient
    .auth
    .onAuthStateChange(
      async (
        event,
        session
      ) => {

        console.log(
          "Supabase Auth Event:",
          event
        );


        if (
          event ===
          "PASSWORD_RECOVERY"
        ) {

          recoveryMode =
            true;

          recoveryHandled =
            true;

          showResetPassword();

          return;
        }


        if (
          recoveryMode ||
          recoveryHandled
        ) {

          if (
            event !==
            "SIGNED_OUT"
          ) {

            showResetPassword();

          }

          return;
        }


        if (
          event ===
          "SIGNED_OUT"
        ) {

          currentUser =
            null;

          currentProfile =
            null;

          showLogin();

        }

      }
    );
}


/* =====================================================
   RECOVERY
===================================================== */

async function handleRecoverySession() {

  if (
    !isRecoveryUrl()
  ) {

    return false;
  }


  recoveryMode =
    true;

  recoveryHandled =
    true;


  const params =
    new URLSearchParams(
      window.location.search
    );


  const code =
    params.get(
      "code"
    );


  if (code) {

    const {
      error
    } =
      await supabaseClient
        .auth
        .exchangeCodeForSession(
          code
        );


    if (error) {

      console.error(
        "RECOVERY CODE ERROR:",
        error
      );

      showResetPassword();


      const message =
        $("resetMessage");


      if (message) {

        message.style.color =
          "var(--danger)";

        message.textContent =
          "رابط استعادة كلمة المرور غير صالح أو انتهت صلاحيته.";

      }


      return true;
    }

  }


  const {
    data
  } =
    await supabaseClient
      .auth
      .getSession();


  if (
    !data?.session
  ) {

    showResetPassword();


    const message =
      $("resetMessage");


    if (message) {

      message.style.color =
        "var(--danger)";

      message.textContent =
        "لم يتم فتح جلسة الاستعادة.";

    }


    return true;
  }


  showResetPassword();


  return true;
}


/* =====================================================
   INITIALIZATION
===================================================== */

async function initializeApp() {

  setupNavigation();

  setupEvents();

  setupAuthListener();


  if (
    $("currentDate")
  ) {

    $("currentDate")
      .textContent =
      new Date()
        .toLocaleDateString(
          "ar",
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


  try {

    const isRecovery =
      await handleRecoverySession();


    if (isRecovery) {
      return;
    }


  } catch (error) {

    console.error(
      "RECOVERY INITIALIZATION ERROR:",
      error
    );


    recoveryMode =
      true;

    recoveryHandled =
      true;

    showResetPassword();

    return;
  }


  const {
    data
  } =
    await supabaseClient
      .auth
      .getSession();


  if (
    recoveryMode ||
    recoveryHandled
  ) {

    showResetPassword();

    return;
  }


  if (
    data?.session
  ) {

    currentUser =
      data.session.user;


    try {

      await loadProfile();

      setupAdminUI();

      await loadDashboard();

      await loadLeaves();


      if (
        isAdmin()
      ) {

        await loadEmployees();

        await loadAdminAttendance();

        await loadAdminLeaves();

      }


      showApp();


    } catch (error) {

      console.error(
        "APP INITIALIZATION ERROR:",
        error
      );


      await supabaseClient
        .auth
        .signOut();


      currentUser =
        null;

      currentProfile =
        null;


      showLogin();


      if (
        $("loginMessage")
      ) {

        $("loginMessage")
          .style
          .color =
          "var(--danger)";


        $("loginMessage")
          .textContent =
          error?.message ||
          "تعذر تحميل بيانات الحساب.";

      }

    }


  } else {

    showLogin();

  }
}


/* =====================================================
   GLOBAL FUNCTIONS
===================================================== */

window.editEmployee =
  editEmployee;

window.editAttendance =
  editAttendance;

window.reviewLeave =
  reviewLeave;


/* =====================================================
   START
===================================================== */

initializeApp();
```
