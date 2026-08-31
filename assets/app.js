/* =====================================================
   DAWAMI1
   Employee Attendance & Payroll System
   Secure Employee / Admin Version
===================================================== */


/* =====================================================
   CONFIG
===================================================== */

const config = window.WORKTRACK_CONFIG;

if (!config) {
  throw new Error("ملف config.js غير موجود.");
}

if (
  !window.supabase ||
  !window.supabase.createClient
) {
  throw new Error("مكتبة Supabase لم يتم تحميلها.");
}

const supabaseClient = window.supabase.createClient(
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
  return (
    "₪" +
    Number(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  );
}


function formatMinutes(minutes) {
  minutes = Math.max(
    0,
    Math.round(Number(minutes || 0))
  );

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}:${String(mins).padStart(2, "0")}`;
}


function getToday() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatTime(date) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleTimeString("ar", {
    hour: "2-digit",
    minute: "2-digit"
  });
}


function formatTimeForInput(date) {
  if (!date) {
    return "";
  }

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  const pad = n =>
    String(n).padStart(2, "0");

  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


function buildTimestamp(date, time) {
  if (!date || !time) {
    return null;
  }

  const parts = time.split(":").map(Number);

  const hours = parts[0];
  const minutes = parts[1];

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  const d = new Date(
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
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-01`;
}


function getMonthEnd() {
  const now = new Date();

  const lastDay = new Date(
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
  return currentProfile?.role === "admin";
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function showMessage(
  elementId,
  text,
  type = "danger"
) {
  const element = $(elementId);

  if (!element) {
    return;
  }

  element.textContent = text;

  element.style.color =
    type === "success"
      ? "var(--success)"
      : "var(--danger)";
}


/* =====================================================
   SCREEN MANAGEMENT
===================================================== */

function showLogin() {
  $("loginScreen")?.classList.remove("hidden");
  $("forgotScreen")?.classList.add("hidden");
  $("resetScreen")?.classList.add("hidden");
  $("app")?.classList.add("hidden");
}


function showForgotPassword() {
  $("loginScreen")?.classList.add("hidden");
  $("forgotScreen")?.classList.remove("hidden");
  $("resetScreen")?.classList.add("hidden");
  $("app")?.classList.add("hidden");
}


function showResetPassword() {
  $("loginScreen")?.classList.add("hidden");
  $("forgotScreen")?.classList.add("hidden");
  $("resetScreen")?.classList.remove("hidden");
  $("app")?.classList.add("hidden");
}


function showApp() {
  $("loginScreen")?.classList.add("hidden");
  $("forgotScreen")?.classList.add("hidden");
  $("resetScreen")?.classList.add("hidden");
  $("app")?.classList.remove("hidden");
}


/* =====================================================
   PASSWORD RECOVERY
===================================================== */

function isRecoveryUrl() {
  const hash =
    window.location.hash || "";

  const search =
    window.location.search || "";

  return (
    hash.includes("type=recovery") ||
    search.includes("type=recovery") ||
    new URLSearchParams(search).has("code")
  );
}


async function sendPasswordReset(email) {
  const redirectUrl =
    window.location.origin +
    window.location.pathname;

  const {
    error
  } =
    await supabaseClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: redirectUrl
      }
    );

  if (error) {
    throw error;
  }
}


async function updatePassword(password) {
  const {
    data,
    error
  } =
    await supabaseClient.auth.updateUser({
      password
    });

  if (error) {
    throw error;
  }

  return data;
}


async function handleResetPassword(event) {
  event.preventDefault();

  const password =
    $("newPassword")?.value || "";

  const confirm =
    $("confirmPassword")?.value || "";

  const message =
    $("resetMessage");

  if (!message) {
    return;
  }

  if (password.length < 6) {
    showMessage(
      "resetMessage",
      "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
    );
    return;
  }

  if (password !== confirm) {
    showMessage(
      "resetMessage",
      "كلمتا المرور غير متطابقتين."
    );
    return;
  }

  showMessage(
    "resetMessage",
    "جاري حفظ كلمة المرور...",
    "success"
  );

  try {
    const {
      data: sessionData
    } =
      await supabaseClient.auth.getSession();

    if (!sessionData?.session) {
      throw new Error(
        "انتهت جلسة استعادة كلمة المرور. اطلبي رابط استعادة جديد."
      );
    }

    await updatePassword(password);

    showMessage(
      "resetMessage",
      "تم تغيير كلمة المرور بنجاح.",
      "success"
    );

    $("resetForm")?.reset();

    recoveryMode = false;
    recoveryHandled = true;

    await supabaseClient.auth.signOut();

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    setTimeout(() => {
      showLogin();

      showMessage(
        "loginMessage",
        "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.",
        "success"
      );
    }, 500);

  } catch (error) {
    console.error(
      "PASSWORD RESET ERROR:",
      error
    );

    showMessage(
      "resetMessage",
      error?.message ||
      "تعذر تغيير كلمة المرور."
    );
  }
}


/* =====================================================
   LOGIN
===================================================== */

async function login(
  email,
  password
) {
  const {
    data,
    error
  } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    throw error;
  }

  if (!data?.user) {
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

  if (isAdmin()) {
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
      .eq("id", currentUser.id)
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

  if ($("welcomeText")) {
    $("welcomeText").textContent =
      `مرحباً ${
        data.full_name || "بك"
      }`;
  }

  if ($("baseSalary")) {
    $("baseSalary").textContent =
      formatMoney(
        data.monthly_salary
      );
  }
}


/* =====================================================
   ADMIN UI
===================================================== */

function setupAdminUI() {
  const admin = isAdmin();

  [
    "adminEmployeesNav",
    "adminAttendanceNav",
    "adminLeavesNav"
  ].forEach(id => {
    const element = $(id);

    if (!element) {
      return;
    }

    element.classList.toggle(
      "hidden",
      !admin
    );
  });
}


/* =====================================================
   ATTENDANCE
   الموظف يستخدم RPC فقط.
===================================================== */

async function getTodayAttendanceForEmployee(
  employeeId = currentUser.id
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("work_date", getToday())
      .order("created_at", {
        ascending: false
      })
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
  الموظف لا يرسل الوقت.
  Supabase يسجل الوقت من السيرفر.
*/

async function clockIn() {
  const {
    data,
    error
  } =
    await supabaseClient.rpc(
      "clock_in"
    );

  if (error) {
    throw error;
  }

  return data;
}


async function clockOut() {
  const {
    data,
    error
  } =
    await supabaseClient.rpc(
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

  button.disabled = true;

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

    } else {
      alert(
        "تم إنهاء دوام اليوم مسبقاً."
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
    button.disabled = false;
  }
}


/* =====================================================
   LOAD ATTENDANCE
===================================================== */

async function loadAttendance(
  employeeId = currentUser.id
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq("employee_id", employeeId)
      .order("work_date", {
        ascending: false
      });

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

  if (!records.length) {
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
    records.map(row => {
      let statusText =
        "مراجعة";

      if (row.status === "complete") {
        statusText = "مكتمل";
      }

      if (row.status === "open") {
        statusText = "مفتوح";
      }

      return `
        <tr>

          <td>
            ${escapeHtml(row.work_date)}
          </td>

          <td>
            ${
              row.clock_in
                ? formatTime(row.clock_in)
                : "—"
            }
          </td>

          <td>
            ${
              row.clock_out
                ? formatTime(row.clock_out)
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
                row.overtime_minutes || 0
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
    }).join("");
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
      .order("holiday_date", {
        ascending: true
      });

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

  if (!holidays?.length) {
    return {
      hours: 0,
      amount: 0
    };
  }

  const attendance =
    await loadAttendance();

  const hourlyRate =
    Number(
      currentProfile?.monthly_salary || 0
    ) /
    (
      (
        Number(
          currentProfile?.work_days_per_week || 6
        ) *
        52 /
        12
      ) *
      Number(
        currentProfile?.work_hours_per_day || 8
      )
    );

  let totalAmount = 0;
  let totalHours = 0;

  for (const holiday of holidays) {
    const worked =
      attendance.find(
        row =>
          row.work_date ===
          holiday.holiday_date
      );

    if (
      Number(holiday.day_number) === 1
    ) {
      totalHours += 8;

      totalAmount +=
        8 * hourlyRate;

      continue;
    }

    if (
      worked &&
      worked.clock_in &&
      worked.clock_out
    ) {
      const minutes =
        Number(
          worked.regular_minutes || 0
        );

      const hours =
        minutes / 60;

      totalHours += hours;

      totalAmount +=
        hours *
        hourlyRate *
        1.5;
    }
  }

  return {
    hours: totalHours,
    amount: totalAmount
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
      .eq("employee_id", currentUser.id)
      .eq("status", "approved");

  if (error) {
    console.error(
      "DEDUCTIONS ERROR:",
      error
    );

    return 0;
  }

  return (
    data || []
  ).reduce(
    (sum, item) =>
      sum +
      Number(item.amount || 0),
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
      currentProfile.monthly_salary || 0
    );

  const holiday =
    await calculateHolidayPay();

  const deductions =
    await calculateDeductions();

  const expected =
    baseSalary +
    holiday.amount -
    deductions;

  if ($("baseSalary")) {
    $("baseSalary").textContent =
      formatMoney(baseSalary);
  }

  if ($("overtimePay")) {
    $("overtimePay").textContent =
      formatMoney(holiday.amount);
  }

  if ($("deductions")) {
    $("deductions").textContent =
      formatMoney(deductions);
  }

  if ($("totalSalary")) {
    $("totalSalary").textContent =
      formatMoney(expected);
  }

  if ($("expectedSalary")) {
    $("expectedSalary").textContent =
      formatMoney(expected);
  }

  if ($("overtimeHours")) {
    $("overtimeHours").textContent =
      formatMinutes(
        Math.round(
          holiday.hours * 60
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
        row.work_date >= monthStart &&
        row.work_date <= monthEnd
    );

  let totalMinutes = 0;

  monthRecords.forEach(row => {
    totalMinutes +=
      Number(
        row.regular_minutes || 0
      );
  });

  if ($("monthlyHours")) {
    $("monthlyHours").textContent =
      formatMinutes(totalMinutes);
  }

  const today =
    await getTodayAttendance();

  if (!today) {
    if ($("todayStatus")) {
      $("todayStatus").textContent =
        "لم تسجل حضورك";
    }

    if ($("todayMessage")) {
      $("todayMessage").textContent =
        "اضغط على الزر لتسجيل بداية الدوام.";
    }

    if ($("attendanceButton")) {
      $("attendanceButton").textContent =
        "تسجيل حضور";
    }

  } else if (
    today.clock_in &&
    !today.clock_out
  ) {
    if ($("todayStatus")) {
      $("todayStatus").textContent =
        "أنت على رأس العمل";
    }

    if ($("todayMessage")) {
      $("todayMessage").textContent =
        `بدأت الساعة ${
          formatTime(today.clock_in)
        }`;
    }

    if ($("attendanceButton")) {
      $("attendanceButton").textContent =
        "تسجيل انصراف";
    }

  } else {
    if ($("todayStatus")) {
      $("todayStatus").textContent =
        "انتهى دوام اليوم";
    }

    if ($("todayMessage")) {
      $("todayMessage").textContent =
        `الحضور ${
          formatTime(today.clock_in)
        } • الانصراف ${
          formatTime(today.clock_out)
        }`;
    }

    if ($("attendanceButton")) {
      $("attendanceButton").textContent =
        "تسجيل حضور";
    }
  }

  const hasError =
    attendance.some(
      row =>
        row.status === "missing_clock_in" ||
        row.status === "missing_clock_out"
    );

  if ($("attendanceAlert")) {
    $("attendanceAlert").textContent =
      hasError
        ? "يوجد خطأ"
        : "سليم";

    $("attendanceAlert").className =
      hasError
        ? "card-value bad"
        : "card-value success";
  }

  renderAttendance(
    attendance.slice(0, 10),
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
      .eq("employee_id", currentUser.id)
      .order("created_at", {
        ascending: false
      });

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
          leave.status === "approved"
      )
      .reduce(
        (sum, leave) =>
          sum +
          Number(
            leave.total_days || 0
          ),
        0
      );

  const available = 18;

  const remaining =
    Math.max(
      0,
      available - used
    );

  if ($("leaveAvailable")) {
    $("leaveAvailable").textContent =
      available;
  }

  if ($("leaveUsed")) {
    $("leaveUsed").textContent =
      used;
  }

  if ($("leaveRemaining")) {
    $("leaveRemaining").textContent =
      remaining;
  }

  if (!leaves.length) {
    if ($("leaveList")) {
      $("leaveList").innerHTML =
        "<p>لا توجد طلبات إجازة.</p>";
    }

    return;
  }

  if ($("leaveList")) {
    $("leaveList").innerHTML =
      leaves.map(leave => {
        let status =
          "قيد المراجعة";

        if (leave.status === "approved") {
          status = "مقبولة";
        }

        if (leave.status === "rejected") {
          status = "مرفوضة";
        }

        return `
          <div class="leave-item">

            <strong>
              ${escapeHtml(leave.start_date)}
              →
              ${escapeHtml(leave.end_date)}
            </strong>

            <span>
              ${
                Number(
                  leave.total_days || 0
                )
              }
              يوم • ${status}
            </span>

          </div>
        `;
      }).join("");
  }
}


/* =====================================================
   CREATE LEAVE
===================================================== */

async function createLeaveRequest(event) {
  event.preventDefault();

  if (!currentUser) {
    alert(
      "يجب تسجيل الدخول أولاً."
    );
    return;
  }

  const start =
    $("leaveStart")?.value;

  const end =
    $("leaveEnd")?.value;

  const reason =
    $("leaveReason")?.value.trim() || "";

  const startDate =
    new Date(`${start}T00:00:00`);

  const endDate =
    new Date(`${end}T00:00:00`);

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
    Number.isNaN(days) ||
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

  $("leaveForm")?.reset();

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
      .order("full_name", {
        ascending: true
      });

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


function renderEmployees(
  employees
) {
  const table =
    $("employeesTable");

  if (!table) {
    return;
  }

  if (!employees.length) {
    table.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          لا يوجد موظفون.
        </td>
      </tr>
    `;

    return;
  }

  table.innerHTML =
    employees.map(employee => {
      const active =
        employee.is_active !== false;

      return `
        <tr>

          <td>
            <strong>
              ${escapeHtml(
                employee.full_name || "—"
              )}
            </strong>
          </td>

          <td>
            ${escapeHtml(
              employee.email || "—"
            )}
          </td>

          <td>
            ${escapeHtml(
              employee.department || "—"
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
                employee.work_hours_per_day || 8
              )
            }
          </td>

          <td>
            ${
              Number(
                employee.work_days_per_week || 6
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
    }).join("");
}


function openEmployeeForm(
  employee = null
) {
  $("employeeForm")
    ?.classList.remove("hidden");

  if ($("employeeId")) {
    $("employeeId").value =
      employee?.id || "";
  }

  if ($("employeeName")) {
    $("employeeName").value =
      employee?.full_name || "";
  }

  if ($("employeeEmail")) {
    $("employeeEmail").value =
      employee?.email || "";
  }

  if ($("employeeNumber")) {
    $("employeeNumber").value =
      employee?.employee_number || "";
  }

  if ($("employeeDepartment")) {
    $("employeeDepartment").value =
      employee?.department || "";
  }

  if ($("employeeJobTitle")) {
    $("employeeJobTitle").value =
      employee?.job_title || "";
  }

  if ($("employeeSalary")) {
    $("employeeSalary").value =
      employee?.monthly_salary ?? "";
  }

  if ($("employeeHours")) {
    $("employeeHours").value =
      employee?.work_hours_per_day ?? 8;
  }

  if ($("employeeDays")) {
    $("employeeDays").value =
      employee?.work_days_per_week ?? 6;
  }
}


async function editEmployee(id) {
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
      .eq("id", id)
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

  openEmployeeForm(data);
}


async function saveEmployee(event) {
  event.preventDefault();

  if (!isAdmin()) {
    alert(
      "ليس لديك صلاحية."
    );
    return;
  }

  const id =
    $("employeeId")
      ?.value
      .trim();

  if (!id) {
    alert(
      "إضافة حساب دخول لموظف جديد تحتاج إنشاء مستخدم Auth من جهة خادمية آمنة."
    );
    return;
  }

  const employee = {
    full_name:
      $("employeeName")
        ?.value
        .trim(),

    email:
      $("employeeEmail")
        ?.value
        .trim(),

    employee_number:
      $("employeeNumber")
        ?.value
        .trim() || null,

    department:
      $("employeeDepartment")
        ?.value
        .trim() || null,

    job_title:
      $("employeeJobTitle")
        ?.value
        .trim() || null,

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
      )
  };

  if (!employee.full_name) {
    alert(
      "اكتبي اسم الموظف."
    );
    return;
  }

  if (!employee.email) {
    alert(
      "اكتبي بريد الموظف."
    );
    return;
  }

  const {
    error
  } =
    await supabaseClient
      .from("profiles")
      .update(employee)
      .eq("id", id);

  if (error) {
    console.error(
      "SAVE EMPLOYEE ERROR:",
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

  if ($("employeeId")) {
    $("employeeId").value = "";
  }

  $("employeeForm")
    ?.classList.add("hidden");

  await loadEmployees();

  alert(
    "تم تحديث بيانات الموظف."
  );
}


/* =====================================================
   ADMIN - ATTENDANCE
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
          email
        )
      `)
      .order("work_date", {
        ascending: false
      });

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


function renderAdminAttendance(
  records
) {
  const table =
    $("adminAttendanceTable");

  if (!table) {
    return;
  }

  if (!records.length) {
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
    records.map(row => {
      const employeeName =
        row.profiles?.full_name ||
        row.profiles?.email ||
        row.employee_id;

      return `
        <tr>

          <td>
            ${escapeHtml(employeeName)}
          </td>

          <td>
            ${escapeHtml(row.work_date)}
          </td>

          <td>
            ${
              row.clock_in
                ? formatTime(row.clock_in)
                : "—"
            }
          </td>

          <td>
            ${
              row.clock_out
                ? formatTime(row.clock_out)
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
                row.status || "—"
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
    }).join("");
}


/* =====================================================
   ADMIN EDIT ATTENDANCE
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
          full_name
        )
      `)
      .eq("id", attendanceId)
      .single();

  if (error) {
    alert(
      error.message
    );
    return;
  }

  const employeeName =
    data.profiles?.full_name ||
    data.employee_id;

  const newDate =
    prompt(
      `تاريخ الدوام للموظف ${employeeName}
التاريخ الحالي: ${data.work_date}
أدخل التاريخ YYYY-MM-DD:`,
      data.work_date
    );

  if (newDate === null) {
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

  if (newClockIn === null) {
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

  if (newClockOut === null) {
    return;
  }

  const newRegular =
    prompt(
      "الساعات العادية بالدقائق:",
      data.regular_minutes || 0
    );

  if (newRegular === null) {
    return;
  }

  const newOvertime =
    prompt(
      "الإضافي بالدقائق:",
      data.overtime_minutes || 0
    );

  if (newOvertime === null) {
    return;
  }

  const clockInTimestamp =
    buildTimestamp(
      newDate,
      newClockIn
    );

  const clockOutTimestamp =
    buildTimestamp(
      newDate,
      newClockOut
    );

  const payload = {
    work_date:
      newDate,

    clock_in:
      clockInTimestamp,

    clock_out:
      clockOutTimestamp,

    regular_minutes:
      Number(
        newRegular || 0
      ),

    overtime_minutes:
      Number(
        newOvertime || 0
      ),

    status:
      clockInTimestamp &&
      clockOutTimestamp
        ? "complete"
        : clockInTimestamp
        ? "open"
        : "missing_clock_in",

    updated_at:
      new Date().toISOString()
  };

  const {
    error: updateError
  } =
    await supabaseClient
      .from("attendance")
      .update(payload)
      .eq("id", attendanceId);

  if (updateError) {
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
   ADMIN - LEAVES
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
          email
        )
      `)
      .order("created_at", {
        ascending: false
      });

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


function renderAdminLeaves(
  leaves
) {
  const table =
    $("adminLeavesTable");

  if (!table) {
    return;
  }

  if (!leaves.length) {
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
    leaves.map(leave => {
      const employee =
        leave.profiles?.full_name ||
        leave.profiles?.email ||
        leave.employee_id;

      let status =
        "قيد المراجعة";

      if (leave.status === "approved") {
        status = "مقبولة";
      }

      if (leave.status === "rejected") {
        status = "مرفوضة";
      }

      return `
        <tr>

          <td>
            ${escapeHtml(employee)}
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
                leave.total_days || 0
              )
            }
          </td>

          <td>
            ${escapeHtml(
              leave.reason || "—"
            )}
          </td>

          <td>
            <span class="pill">
              ${status}
            </span>
          </td>

          <td>

            ${
              leave.status === "pending"
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
    }).join("");
}


async function reviewLeave(
  leaveId,
  status
) {
  if (!isAdmin()) {
    alert(
      "ليس لديك صلاحية."
    );
    return;
  }

  if (
    status !== "approved" &&
    status !== "rejected"
  ) {
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
          new Date().toISOString()
      })
      .eq("id", leaveId);

  if (error) {
    alert(
      error.message
    );
    return;
  }

  await loadAdminLeaves();

  alert(
    status === "approved"
      ? "تم قبول الإجازة."
      : "تم رفض الإجازة."
  );
}


/* =====================================================
   NAVIGATION
===================================================== */

function setupNavigation() {
  document
    .querySelectorAll(".nav-btn")
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          document
            .querySelectorAll(".nav-btn")
            .forEach(btn =>
              btn.classList.remove(
                "active"
              )
            );

          button.classList.add(
            "active"
          );

          document
            .querySelectorAll(".page")
            .forEach(page =>
              page.classList.remove(
                "active"
              )
            );

          const page =
            $(button.dataset.page);

          if (page) {
            page.classList.add(
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
    });
}


/* =====================================================
   LOGOUT
===================================================== */

async function logout() {
  await supabaseClient
    .auth
    .signOut();

  currentUser = null;
  currentProfile = null;

  recoveryMode = false;
  recoveryHandled = false;

  window.history.replaceState(
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

        const email =
          $("email")
            ?.value
            .trim();

        const password =
          $("password")
            ?.value || "";

        showMessage(
          "loginMessage",
          "جاري تسجيل الدخول...",
          "success"
        );

        try {
          await login(
            email,
            password
          );

          showMessage(
            "loginMessage",
            "",
            "success"
          );

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
              "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
          }

          if (
            error?.message
              ?.toLowerCase()
              .includes(
                "email not confirmed"
              )
          ) {
            errorMessage =
              "البريد الإلكتروني للحساب غير مؤكد.";
          }

          showMessage(
            "loginMessage",
            errorMessage
          );
        }
      }
    );


  /* FORGOT PASSWORD */

  $("forgotPasswordBtn")
    ?.addEventListener(
      "click",
      () => {
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
            ?.value
            .trim();

        showMessage(
          "forgotMessage",
          "جاري إرسال الرابط...",
          "success"
        );

        try {
          await sendPasswordReset(
            email
          );

          showMessage(
            "forgotMessage",
            "تم إرسال رابط تغيير كلمة المرور إلى بريدك الإلكتروني.",
            "success"
          );

        } catch (error) {
          console.error(
            "RESET EMAIL ERROR:",
            error
          );

          showMessage(
            "forgotMessage",
            error?.message ||
            "تعذر إرسال رابط الاستعادة."
          );
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
        if (!isAdmin()) {
          alert(
            "ليس لديك صلاحية."
          );
          return;
        }

        $("employeeForm")
          ?.reset();

        if ($("employeeId")) {
          $("employeeId").value =
            "";
        }

        if ($("employeeHours")) {
          $("employeeHours").value =
            8;
        }

        if ($("employeeDays")) {
          $("employeeDays").value =
            6;
        }

        $("employeeForm")
          ?.classList
          .remove("hidden");
      }
    );


  /* CANCEL EMPLOYEE */

  $("cancelEmployeeForm")
    ?.addEventListener(
      "click",
      () => {
        $("employeeForm")
          ?.reset();

        if ($("employeeId")) {
          $("employeeId").value =
            "";
        }

        $("employeeForm")
          ?.classList
          .add("hidden");
      }
    );


  /* SAVE EMPLOYEE */

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
  supabaseClient.auth.onAuthStateChange(
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
        recoveryMode = true;
        recoveryHandled = true;

        showResetPassword();

        return;
      }

      if (
        event ===
        "SIGNED_OUT"
      ) {
        currentUser = null;
        currentProfile = null;

        if (!recoveryMode) {
          showLogin();
        }

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
        "SIGNED_IN" &&
        session?.user
      ) {
        currentUser =
          session.user;
      }
    }
  );
}


/* =====================================================
   RECOVERY SESSION
===================================================== */

async function handleRecoverySession() {
  if (!isRecoveryUrl()) {
    return false;
  }

  recoveryMode = true;
  recoveryHandled = true;

  const params =
    new URLSearchParams(
      window.location.search
    );

  const code =
    params.get("code");

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

      showMessage(
        "resetMessage",
        "رابط استعادة كلمة المرور غير صالح أو انتهت صلاحيته."
      );

      return true;
    }
  }

  const {
    data
  } =
    await supabaseClient.auth.getSession();

  if (!data?.session) {
    showResetPassword();

    showMessage(
      "resetMessage",
      "لم يتم فتح جلسة الاستعادة. اطلبي رابط تغيير كلمة المرور من جديد."
    );

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


  if ($("currentDate")) {
    $("currentDate").textContent =
      new Date().toLocaleDateString(
        "ar",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
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

    recoveryMode = true;
    recoveryHandled = true;

    showResetPassword();

    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient.auth.getSession();

  if (error) {
    console.error(
      "GET SESSION ERROR:",
      error
    );

    showLogin();

    return;
  }


  if (
    recoveryMode ||
    recoveryHandled
  ) {
    showResetPassword();
    return;
  }


  if (data?.session) {

    currentUser =
      data.session.user;

    try {

      await loadProfile();

      setupAdminUI();

      await loadDashboard();

      await loadLeaves();

      if (isAdmin()) {
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

      currentUser = null;
      currentProfile = null;

      showLogin();

      showMessage(
        "loginMessage",
        error?.message ||
        "تعذر تحميل بيانات الحساب."
      );
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
