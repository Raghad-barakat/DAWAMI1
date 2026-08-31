/* =====================================================
   DAWAMI1
   Employee Attendance & Payroll System
   ===================================================== */

const config = window.WORKTRACK_CONFIG;

const supabaseClient = supabase.createClient(
  config.SUPABASE_URL,
  config.SUPABASE_KEY
);

let currentUser = null;
let currentProfile = null;


// =====================================================
// HELPERS
// =====================================================

function $(id) {
  return document.getElementById(id);
}

function formatMoney(amount) {
  return "₪" + Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatMinutes(minutes) {
  minutes = Math.max(0, Math.round(Number(minutes || 0)));

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}:${String(mins).padStart(2, "0")}`;
}

function getToday() {
  return new Date().toLocaleDateString("en-CA");
}

function formatTime(date) {
  if (!date) return "—";

  return new Date(date).toLocaleTimeString("ar", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateTimeLocal(date) {
  if (!date) return "";

  const d = new Date(date);

  const pad = n => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  return lastDay.toLocaleDateString("en-CA");
}

function isAdmin() {
  return currentProfile?.role === "admin";
}

function showLogin() {
  $("loginScreen").classList.remove("hidden");
  $("app").classList.add("hidden");
}

function showApp() {
  $("loginScreen").classList.add("hidden");
  $("app").classList.remove("hidden");
}


// =====================================================
// LOGIN
// =====================================================

async function login(email, password) {

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    throw error;
  }

  currentUser = data.user;

  await loadProfile();
  await setupAdminUI();
  await loadDashboard();
  await loadLeaves();

  if (isAdmin()) {
    await loadEmployees();
    await loadAdminAttendance();
    await loadAdminLeaves();
  }

  showApp();
}


// =====================================================
// PROFILE
// =====================================================

async function loadProfile() {

  const { data, error } =
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
      "لا يوجد ملف موظف مرتبط بهذا الحساب."
    );
  }

  currentProfile = data;

  if ($("welcomeText")) {
    $("welcomeText").textContent =
      `مرحباً ${data.full_name || "بك"}`;
  }

  if ($("baseSalary")) {
    $("baseSalary").textContent =
      formatMoney(data.monthly_salary);
  }
}


// =====================================================
// ADMIN UI
// =====================================================

async function setupAdminUI() {

  const admin =
    isAdmin();

  [
    "adminEmployeesNav",
    "adminAttendanceNav",
    "adminLeavesNav"
  ].forEach(id => {

    const el = $(id);

    if (!el) return;

    if (admin) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}


// =====================================================
// TODAY ATTENDANCE
// =====================================================

async function getTodayAttendanceForEmployee(
  employeeId = currentUser.id
) {

  const { data, error } =
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
    console.error(error);
    return null;
  }

  return data;
}

async function getTodayAttendance() {
  return getTodayAttendanceForEmployee(
    currentUser.id
  );
}


// =====================================================
// CLOCK IN
// =====================================================

async function clockIn() {

  const existing =
    await getTodayAttendance();

  if (
    existing &&
    existing.clock_in &&
    !existing.clock_out
  ) {
    return;
  }

  const now =
    new Date().toISOString();

  const { error } =
    await supabaseClient
      .from("attendance")
      .insert({

        employee_id:
          currentUser.id,

        work_date:
          getToday(),

        clock_in:
          now,

        clock_out:
          null,

        regular_minutes:
          0,

        overtime_minutes:
          0,

        late_minutes:
          0,

        status:
          "open"

      });

  if (error) {
    throw error;
  }
}


// =====================================================
// CLOCK OUT
// =====================================================

async function clockOut() {

  const attendance =
    await getTodayAttendance();

  if (
    !attendance ||
    !attendance.clock_in ||
    attendance.clock_out
  ) {
    return;
  }

  const clockInTime =
    new Date(attendance.clock_in);

  const clockOutTime =
    new Date();

  const totalMinutes =
    Math.max(
      0,
      Math.round(
        (
          clockOutTime -
          clockInTime
        ) / 60000
      )
    );

  const standardHours =
    Number(
      currentProfile.work_hours_per_day || 8
    );

  const standardMinutes =
    standardHours * 60;

  const regularMinutes =
    Math.min(
      totalMinutes,
      standardMinutes
    );

  const overtimeMinutes =
    Math.max(
      0,
      totalMinutes -
      standardMinutes
    );

  const { error } =
    await supabaseClient
      .from("attendance")
      .update({

        clock_out:
          clockOutTime.toISOString(),

        regular_minutes:
          regularMinutes,

        overtime_minutes:
          overtimeMinutes,

        status:
          "complete",

        updated_at:
          new Date().toISOString()

      })
      .eq(
        "id",
        attendance.id
      );

  if (error) {
    throw error;
  }
}


// =====================================================
// ATTENDANCE BUTTON
// =====================================================

async function handleAttendance() {

  const button =
    $("attendanceButton");

  button.disabled = true;

  try {

    const attendance =
      await getTodayAttendance();

    if (
      !attendance ||
      !attendance.clock_in
    ) {

      await clockIn();

    } else if (
      attendance.clock_in &&
      !attendance.clock_out
    ) {

      await clockOut();

    }

    await loadDashboard();

  } catch (error) {

    console.error(error);

    alert(
      error.message ||
      "حدث خطأ أثناء تسجيل الدوام."
    );

  } finally {

    button.disabled = false;

  }
}


// =====================================================
// LOAD ATTENDANCE
// =====================================================

async function loadAttendance(
  employeeId = currentUser.id
) {

  const { data, error } =
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
          ascending: false
        }
      );

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}


// =====================================================
// HOLIDAY PAY
// =====================================================

async function calculateHolidayPay() {

  const { data: holidays, error } =
    await supabaseClient
      .from("holidays")
      .select("*")
      .order(
        "holiday_date",
        {
          ascending: true
        }
      );

  if (error) {

    console.error(error);

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
      currentProfile.monthly_salary || 0
    ) /
    (
      Number(
        currentProfile.work_days_per_week || 6
      ) *
      52 /
      12 *
      Number(
        currentProfile.work_hours_per_day || 8
      )
    );

  let totalAmount = 0;
  let totalHours = 0;

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
    hours:
      totalHours,

    amount:
      totalAmount
  };
}


// =====================================================
// DEDUCTIONS
// =====================================================

async function calculateDeductions() {

  const { data, error } =
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

    console.error(error);

    return 0;

  }

  return (
    data || []
  ).reduce(
    (sum, item) =>
      sum +
      Number(
        item.amount || 0
      ),
    0
  );
}


// =====================================================
// PAYROLL
// =====================================================

async function calculatePayroll() {

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

  $("baseSalary").textContent =
    formatMoney(baseSalary);

  $("overtimePay").textContent =
    formatMoney(holiday.amount);

  $("deductions").textContent =
    formatMoney(deductions);

  $("totalSalary").textContent =
    formatMoney(expected);

  $("expectedSalary").textContent =
    formatMoney(expected);

  $("overtimeHours").textContent =
    formatMinutes(
      Math.round(
        holiday.hours * 60
      )
    );
}


// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard() {

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

  monthRecords.forEach(
    row => {

      totalMinutes +=
        Number(
          row.regular_minutes || 0
        );

    }
  );

  $("monthlyHours").textContent =
    formatMinutes(
      totalMinutes
    );

  const today =
    await getTodayAttendance();

  if (!today) {

    $("todayStatus").textContent =
      "لم تسجل حضورك";

    $("todayMessage").textContent =
      "اضغط على الزر لتسجيل بداية الدوام.";

    $("attendanceButton").textContent =
      "تسجيل حضور";

  } else if (
    today.clock_in &&
    !today.clock_out
  ) {

    $("todayStatus").textContent =
      "أنت على رأس العمل";

    $("todayMessage").textContent =
      `بدأت الساعة ${formatTime(
        today.clock_in
      )}`;

    $("attendanceButton").textContent =
      "تسجيل انصراف";

  } else {

    $("todayStatus").textContent =
      "انتهى دوام اليوم";

    $("todayMessage").textContent =
      `الحضور ${formatTime(
        today.clock_in
      )} • الانصراف ${formatTime(
        today.clock_out
      )}`;

    $("attendanceButton").textContent =
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

  $("attendanceAlert").textContent =
    hasError
      ? "يوجد خطأ"
      : "سليم";

  $("attendanceAlert").className =
    hasError
      ? "bad"
      : "success";

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


// =====================================================
// ATTENDANCE TABLE
// =====================================================

function renderAttendance(
  records,
  element
) {

  if (!element) return;

  if (!records.length) {

    element.innerHTML = `
      <tr>
        <td colspan="6">
          لا توجد سجلات دوام بعد.
        </td>
      </tr>
    `;

    return;
  }

  element.innerHTML =
    records.map(
      row => {

        return `
          <tr>

            <td>${row.work_date}</td>

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
                ${
                  row.status === "complete"
                    ? "مكتمل"
                    : row.status === "open"
                    ? "مفتوح"
                    : "مراجعة"
                }
              </span>
            </td>

          </tr>
        `;
      }
    ).join("");
}


// =====================================================
// LEAVES
// =====================================================

async function loadLeaves() {

  const { data, error } =
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
          ascending: false
        }
      );

  if (error) {

    console.error(error);

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
        (sum, leave) =>
          sum +
          Number(
            leave.total_days || 0
          ),
        0
      );

  const available =
    18;

  const remaining =
    Math.max(
      0,
      available - used
    );

  $("leaveAvailable").textContent =
    available;

  $("leaveUsed").textContent =
    used;

  $("leaveRemaining").textContent =
    remaining;

  if (!leaves.length) {

    $("leaveList").innerHTML =
      "<p>لا توجد طلبات إجازة.</p>";

    return;
  }

  $("leaveList").innerHTML =
    leaves.map(
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
              ${leave.start_date}
              →
              ${leave.end_date}
            </strong>

            <span>
              ${leave.total_days}
              يوم •
              ${status}
            </span>

          </div>
        `;
      }
    ).join("");
}


// =====================================================
// CREATE LEAVE
// =====================================================

async function createLeaveRequest(
  event
) {

  event.preventDefault();

  const start =
    $("leaveStart").value;

  const end =
    $("leaveEnd").value;

  const reason =
    $("leaveReason").value.trim();

  const startDate =
    new Date(start);

  const endDate =
    new Date(end);

  const days =
    Math.round(
      (
        endDate -
        startDate
      ) / 86400000
    ) + 1;

  if (days <= 0) {

    alert(
      "تاريخ الإجازة غير صحيح."
    );

    return;
  }

  const { error } =
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

    alert(error.message);

    return;
  }

  $("leaveForm").reset();

  await loadLeaves();

  alert(
    "تم إرسال طلب الإجازة بنجاح."
  );
}


// =====================================================
// ADMIN - EMPLOYEES
// =====================================================

async function loadEmployees() {

  if (!isAdmin()) return;

  const { data, error } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .order(
        "full_name",
        {
          ascending: true
        }
      );

  if (error) {

    console.error(error);

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

  if (!table) return;

  if (!employees.length) {

    table.innerHTML = `
      <tr>
        <td colspan="8">
          لا يوجد موظفون.
        </td>
      </tr>
    `;

    return;
  }

  table.innerHTML =
    employees.map(
      employee => {

        return `
          <tr>

            <td>
              ${escapeHtml(
                employee.full_name || "—"
              )}
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
              ${Number(
                employee.work_hours_per_day || 8
              )}
            </td>

            <td>
              ${Number(
                employee.work_days_per_week || 6
              )}
            </td>

            <td>
              <span class="pill">
                ${
                  employee.is_active
                    ? "فعال"
                    : "غير فعال"
                }
              </span>
            </td>

            <td>
              <button
                class="secondary-button"
                onclick="editEmployee('${employee.id}')">
                تعديل
              </button>
            </td>

          </tr>
        `;
      }
    ).join("");
}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// EMPLOYEE FORM
// =====================================================

function openEmployeeForm(
  employee = null
) {

  $("employeeForm")
    .classList.remove("hidden");

  $("employeeId").value =
    employee?.id || "";

  $("employeeName").value =
    employee?.full_name || "";

  $("employeeEmail").value =
    employee?.email || "";

  $("employeeNumber").value =
    employee?.employee_number || "";

  $("employeeDepartment").value =
    employee?.department || "";

  $("employeeJobTitle").value =
    employee?.job_title || "";

  $("employeeSalary").value =
    employee?.monthly_salary ?? "";

  $("employeeHours").value =
    employee?.work_hours_per_day ?? 8;

  $("employeeDays").value =
    employee?.work_days_per_week ?? 6;
}


async function editEmployee(
  employeeId
) {

  const { data, error } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq(
        "id",
        employeeId
      )
      .single();

  if (error) {

    alert(error.message);

    return;
  }

  openEmployeeForm(data);
}


async function saveEmployee(
  event
) {

  event.preventDefault();

  if (!isAdmin()) {

    alert(
      "ليس لديك صلاحية لإدارة الموظفين."
    );

    return;
  }

  const id =
    $("employeeId").value.trim();

  const payload = {

    full_name:
      $("employeeName").value.trim(),

    email:
      $("employeeEmail").value.trim(),

    employee_number:
      $("employeeNumber").value.trim() || null,

    department:
      $("employeeDepartment").value.trim() || null,

    job_title:
      $("employeeJobTitle").value.trim() || null,

    monthly_salary:
      Number(
        $("employeeSalary").value || 0
      ),

    work_hours_per_day:
      Number(
        $("employeeHours").value || 8
      ),

    work_days_per_week:
      Number(
        $("employeeDays").value || 6
      )

  };

  let result;

  if (id) {

    result =
      await supabaseClient
        .from("profiles")
        .update(payload)
        .eq("id", id);

  } else {

    alert(
      "إضافة موظف جديد تحتاج إنشاء حساب Auth للموظف أولاً. سنربطها بالـ Edge Function في الخطوة التالية."
    );

    return;
  }

  if (result.error) {

    alert(
      result.error.message
    );

    return;
  }

  $("employeeForm")
    .classList.add("hidden");

  $("employeeForm").reset();

  await loadEmployees();

  alert(
    "تم حفظ بيانات الموظف."
  );
}


// =====================================================
// ADMIN - ATTENDANCE
// =====================================================

async function loadAdminAttendance() {

  if (!isAdmin()) return;

  const { data, error } =
    await supabaseClient
      .from("attendance")
      .select(`
        *,
        profiles:employee_id (
          full_name,
          email
        )
      `)
      .order(
        "work_date",
        {
          ascending: false
        }
      );

  if (error) {

    console.error(error);

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

  if (!table) return;

  if (!records.length) {

    table.innerHTML = `
      <tr>
        <td colspan="8">
          لا توجد سجلات دوام.
        </td>
      </tr>
    `;

    return;
  }

  table.innerHTML =
    records.map(
      row => {

        const employeeName =
          row.profiles?.full_name ||
          row.profiles?.email ||
          row.employee_id;

        return `
          <tr>

            <td>
              ${escapeHtml(
                employeeName
              )}
            </td>

            <td>
              ${row.work_date}
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
                onclick="editAttendance('${row.id}')">
                تعديل
              </button>
            </td>

          </tr>
        `;
      }
    ).join("");
}


// =====================================================
// EDIT ATTENDANCE
// =====================================================

async function editAttendance(
  attendanceId
) {

  if (!isAdmin()) {

    alert(
      "ليس لديك صلاحية."
    );

    return;
  }

  const { data, error } =
    await supabaseClient
      .from("attendance")
      .select(`
        *,
        profiles:employee_id (
          full_name
        )
      `)
      .eq(
        "id",
        attendanceId
      )
      .single();

  if (error) {

    alert(error.message);

    return;
  }

  const employeeName =
    data.profiles?.full_name ||
    data.employee_id;

  const newDate =
    prompt(
      `تاريخ الدوام للموظف ${employeeName}\nالتاريخ الحالي: ${data.work_date}\nأدخل التاريخ YYYY-MM-DD:`,
      data.work_date
    );

  if (newDate === null) return;

  const newClockIn =
    prompt(
      "أدخل وقت الحضور بصيغة HH:MM أو اتركه فارغاً:",
      data.clock_in
        ? formatTimeForInput(data.clock_in)
        : ""
    );

  if (newClockIn === null) return;

  const newClockOut =
    prompt(
      "أدخل وقت الانصراف بصيغة HH:MM أو اتركه فارغاً:",
      data.clock_out
        ? formatTimeForInput(data.clock_out)
        : ""
    );

  if (newClockOut === null) return;

  const newRegular =
    prompt(
      "الساعات العادية بالدقائق:",
      data.regular_minutes || 0
    );

  if (newRegular === null) return;

  const newOvertime =
    prompt(
      "الإضافي بالدقائق:",
      data.overtime_minutes || 0
    );

  if (newOvertime === null) return;

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
      Number(newRegular || 0),

    overtime_minutes:
      Number(newOvertime || 0),

    status:
      newClockIn && newClockOut
        ? "complete"
        : newClockIn
        ? "open"
        : "missing_clock_in",

    updated_at:
      new Date().toISOString()

  };

  const { error: updateError } =
    await supabaseClient
      .from("attendance")
      .update(payload)
      .eq(
        "id",
        attendanceId
      );

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


function formatTimeForInput(
  date
) {

  const d =
    new Date(date);

  const pad =
    n => String(n).padStart(2, "0");

  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


function buildTimestamp(
  date,
  time
) {

  if (!date || !time) {
    return null;
  }

  const [hours, minutes] =
    time.split(":").map(Number);

  const d =
    new Date(`${date}T00:00:00`);

  d.setHours(
    hours,
    minutes,
    0,
    0
  );

  return d.toISOString();
}


// =====================================================
// ADMIN - LEAVES
// =====================================================

async function loadAdminLeaves() {

  if (!isAdmin()) return;

  const { data, error } =
    await supabaseClient
      .from("leave_requests")
      .select(`
        *,
        profiles:employee_id (
          full_name,
          email
        )
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    console.error(error);

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

  if (!table) return;

  if (!leaves.length) {

    table.innerHTML = `
      <tr>
        <td colspan="7">
          لا توجد طلبات إجازة.
        </td>
      </tr>
    `;

    return;
  }

  table.innerHTML =
    leaves.map(
      leave => {

        const employee =
          leave.profiles?.full_name ||
          leave.profiles?.email ||
          leave.employee_id;

        let status =
          "قيد المراجعة";

        if (
          leave.status === "approved"
        ) {
          status = "مقبولة";
        }

        if (
          leave.status === "rejected"
        ) {
          status = "مرفوضة";
        }

        return `
          <tr>

            <td>
              ${escapeHtml(employee)}
            </td>

            <td>
              ${leave.start_date}
            </td>

            <td>
              ${leave.end_date}
            </td>

            <td>
              ${leave.total_days}
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
                      onclick="reviewLeave('${leave.id}', 'approved')">
                      قبول
                    </button>

                    <button
                      class="secondary-button"
                      onclick="reviewLeave('${leave.id}', 'rejected')">
                      رفض
                    </button>
                  `

                  : "—"
              }

            </td>

          </tr>
        `;
      }
    ).join("");
}


async function reviewLeave(
  leaveId,
  status
) {

  if (!isAdmin()) return;

  const { error } =
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
      .eq(
        "id",
        leaveId
      );

  if (error) {

    alert(error.message);

    return;
  }

  await loadAdminLeaves();

  alert(
    status === "approved"
      ? "تم قبول الإجازة."
      : "تم رفض الإجازة."
  );
}


// =====================================================
// NAVIGATION
// =====================================================

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


// =====================================================
// LOGOUT
// =====================================================

async function logout() {

  await supabaseClient.auth.signOut();

  currentUser = null;

  currentProfile = null;

  showLogin();
}


// =====================================================
// EVENTS
// =====================================================

function setupEvents() {

  $("loginForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const email =
          $("email").value.trim();

        const password =
          $("password").value;

        const message =
          $("loginMessage");

        message.textContent =
          "جاري تسجيل الدخول...";

        try {

          await login(
            email,
            password
          );

          message.textContent = "";

        } catch (error) {

          console.error(error);

          message.textContent =
            "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        }
      }
    );


  $("attendanceButton")
    .addEventListener(
      "click",
      handleAttendance
    );


  $("leaveForm")
    .addEventListener(
      "submit",
      createLeaveRequest
    );


  $("logoutBtn")
    .addEventListener(
      "click",
      logout
    );


  $("showEmployeeForm")
    ?.addEventListener(
      "click",
      () => openEmployeeForm()
    );


  $("cancelEmployeeForm")
    ?.addEventListener(
      "click",
      () => {

        $("employeeForm")
          .classList.add("hidden");

        $("employeeForm").reset();

      }
    );


  $("employeeForm")
    ?.addEventListener(
      "submit",
      saveEmployee
    );
}


// =====================================================
// INITIALIZATION
// =====================================================

async function initializeApp() {

  setupNavigation();

  setupEvents();

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

  const {
    data
  } =
    await supabaseClient.auth.getSession();

  if (
    data &&
    data.session
  ) {

    currentUser =
      data.session.user;

    try {

      await loadProfile();

      await setupAdminUI();

      await loadDashboard();

      await loadLeaves();

      if (isAdmin()) {

        await loadEmployees();

        await loadAdminAttendance();

        await loadAdminLeaves();

      }

      showApp();

    } catch (error) {

      console.error(error);

      await supabaseClient.auth.signOut();

      showLogin();

    }

  } else {

    showLogin();

  }
}


initializeApp();
// =====================================================
// ADMIN - EMPLOYEES
// =====================================================

async function loadEmployees() {

  if (!currentProfile || currentProfile.role !== "admin") {
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) {
    console.error(error);
    alert("تعذر تحميل الموظفين.");
    return;
  }

  renderEmployees(data || []);
}


// =====================================================
// RENDER EMPLOYEES
// =====================================================

function renderEmployees(employees) {

  const table = $("employeesTable");

  if (!table) return;

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

  table.innerHTML = employees.map(employee => {

    const active =
      employee.is_active !== false;

    return `
      <tr>

        <td>
          <strong>
            ${employee.full_name || "—"}
          </strong>
        </td>

        <td>
          ${employee.email || "—"}
        </td>

        <td>
          ${employee.department || "—"}
        </td>

        <td>
          ${formatMoney(employee.monthly_salary)}
        </td>

        <td>
          ${employee.work_hours_per_day || 8}
        </td>

        <td>
          ${employee.work_days_per_week || 6}
        </td>

        <td>
          <span class="pill ${
            active ? "success" : "bad"
          }">
            ${active ? "نشط" : "غير نشط"}
          </span>
        </td>

        <td>

          <button
            class="secondary-button"
            onclick="editEmployee('${employee.id}')">
            تعديل
          </button>

        </td>

      </tr>
    `;

  }).join("");
}


// =====================================================
// EDIT EMPLOYEE
// =====================================================

async function editEmployee(id) {

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {

    alert("تعذر تحميل بيانات الموظف.");

    return;
  }

  $("employeeId").value =
    data.id;

  $("employeeName").value =
    data.full_name || "";

  $("employeeEmail").value =
    data.email || "";

  $("employeeNumber").value =
    data.employee_number || "";

  $("employeeDepartment").value =
    data.department || "";

  $("employeeJobTitle").value =
    data.job_title || "";

  $("employeeSalary").value =
    data.monthly_salary || 0;

  $("employeeHours").value =
    data.work_hours_per_day || 8;

  $("employeeDays").value =
    data.work_days_per_week || 6;

  $("employeeForm")
    .classList.remove("hidden");

}


// =====================================================
// SAVE EMPLOYEE DATA
// =====================================================

async function saveEmployee(event) {

  event.preventDefault();

  if (
    !currentProfile ||
    currentProfile.role !== "admin"
  ) {

    alert("ليس لديك صلاحية.");

    return;
  }

  const id =
    $("employeeId").value;

  const employee = {

    full_name:
      $("employeeName").value.trim(),

    email:
      $("employeeEmail").value.trim(),

    employee_number:
      $("employeeNumber").value.trim() || null,

    department:
      $("employeeDepartment").value.trim() || null,

    job_title:
      $("employeeJobTitle").value.trim() || null,

    monthly_salary:
      Number($("employeeSalary").value || 0),

    work_hours_per_day:
      Number($("employeeHours").value || 8),

    work_days_per_week:
      Number($("employeeDays").value || 6)

  };


  if (!employee.full_name) {

    alert("اكتبي اسم الموظف.");

    return;
  }


  if (!employee.email) {

    alert("اكتبي بريد الموظف.");

    return;
  }


  // تعديل موظف موجود
  if (id) {

    const { error } =
      await supabaseClient
        .from("profiles")
        .update(employee)
        .eq("id", id);

    if (error) {

      console.error(error);

      alert(
        "تعذر حفظ بيانات الموظف: " +
        error.message
      );

      return;
    }

    alert("تم تحديث بيانات الموظف.");

  }


  // موظف جديد
  else {

    alert(
      "بيانات الموظف جاهزة، لكن إنشاء حساب تسجيل الدخول يحتاج ربطًا خادميًا آمنًا مع Supabase Auth."
    );

    return;
  }


  $("employeeForm").reset();

  $("employeeId").value = "";

  $("employeeForm")
    .classList.add("hidden");

  await loadEmployees();

}


// =====================================================
// EMPLOYEE FORM EVENTS
// =====================================================

function setupEmployeeManagement() {

  const form =
    $("employeeForm");

  const showButton =
    $("showEmployeeForm");

  const cancelButton =
    $("cancelEmployeeForm");


  if (showButton) {

    showButton.addEventListener(
      "click",
      () => {

        $("employeeId").value = "";

        form.reset();

        $("employeeHours").value = 8;

        $("employeeDays").value = 6;

        form.classList.remove(
          "hidden"
        );

      }
    );

  }


  if (cancelButton) {

    cancelButton.addEventListener(
      "click",
      () => {

        form.reset();

        $("employeeId").value = "";

        form.classList.add(
          "hidden"
        );

      }
    );

  }


  if (form) {

    form.addEventListener(
      "submit",
      saveEmployee
    );

  }

}


// =====================================================
// ADMIN NAVIGATION
// =====================================================

function setupAdminAccess() {

  if (
    !currentProfile ||
    currentProfile.role !== "admin"
  ) {

    return;
  }


  $("adminEmployeesNav")
    ?.classList.remove("hidden");

  $("adminAttendanceNav")
    ?.classList.remove("hidden");

  $("adminLeavesNav")
    ?.classList.remove("hidden");


  setupEmployeeManagement();

  loadEmployees();

}


// =====================================================
// GLOBAL FUNCTIONS FOR HTML BUTTONS
// =====================================================

window.editEmployee =
  editEmployee;

window.editAttendance =
  editAttendance;

window.reviewLeave =
  reviewLeave;
