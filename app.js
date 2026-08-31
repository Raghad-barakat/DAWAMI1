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
  minutes = Math.max(0, Math.round(minutes || 0));

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}:${String(mins).padStart(2, "0")}`;
}


function getToday() {
  return new Date().toLocaleDateString("en-CA");
}


function formatTime(date) {
  return new Date(date).toLocaleTimeString("ar", {
    hour: "2-digit",
    minute: "2-digit"
  });
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
  await loadDashboard();
  await loadLeaves();

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

  $("welcomeText").textContent =
    `مرحباً ${data.full_name || "بك"}`;

  $("baseSalary").textContent =
    formatMoney(data.monthly_salary);

}


// =====================================================
// TODAY ATTENDANCE
// =====================================================

async function getTodayAttendance() {

  const { data, error } =
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq("employee_id", currentUser.id)
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


  /*
    مهم:
    هذا الحساب يسمح للدوام أن يتجاوز منتصف الليل.

    مثال:
    4:00 PM → 12:00 AM
    أو
    4:00 PM → 2:00 AM

    يتم حساب الفرق من timestamp الحقيقي،
    وليس من تاريخ اليوم فقط.
  */

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


  /*
    الساعات العادية فقط.

    أي ساعات إضافية في الأيام العادية
    لا يتم تحويلها تلقائياً إلى أجر إضافي.
  */

  const regularMinutes =
    Math.min(
      totalMinutes,
      standardMinutes
    );


  /*
    نسجل الزيادة في overtime_minutes
    لأغراض إدارية فقط.

    لا يتم دفعها تلقائياً.
  */

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

    }

    else if (
      attendance.clock_in &&
      !attendance.clock_out
    ) {

      await clockOut();

    }

    await loadDashboard();

  }

  catch (error) {

    console.error(error);

    alert(
      error.message ||
      "حدث خطأ أثناء تسجيل الدوام."
    );

  }

  finally {

    button.disabled = false;

  }
}


// =====================================================
// LOAD ATTENDANCE
// =====================================================

async function loadAttendance() {

  const { data, error } =
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

  /*
    نظام الأعياد:

    عيد الفطر:
    اليوم الأول = 8 ساعات للجميع
    اليوم 2 و3 = من داوم فقط × 1.5

    عيد الأضحى:
    اليوم الأول = 8 ساعات للجميع
    اليوم 2 و3 و4 = من داوم فقط × 1.5
  */


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


  if (!holidays || !holidays.length) {

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


    /*
      اليوم الأول:
      8 ساعات للجميع.

      هذا يدخل ضمن الراتب المستحق
      حتى لو لم يوجد attendance.
    */

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


    /*
      باقي أيام العيد:
      فقط إذا الموظف داوم.

      الساعة × 1.5
    */

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

async function calculatePayroll(
  attendance
) {

  const baseSalary =
    Number(
      currentProfile.monthly_salary || 0
    );


  const holiday =
    await calculateHolidayPay();


  const deductions =
    await calculateDeductions();


  /*
    لا ندفع overtime العادي.

    فقط بدل الأعياد يدخل كدفعة إضافية.
  */

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


  /*
    نحسب ساعات الشهر الحالي فقط.
  */

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

  }

  else if (
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

  }

  else {

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


  /*
    الخطأ فقط إذا كان عندنا سجل ناقص.
  */

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


  await calculatePayroll(
    attendance
  );

}


// =====================================================
// ATTENDANCE TABLE
// =====================================================

function renderAttendance(
  records,
  element
) {

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

            <td>
              ${row.work_date}
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
                  row.status ===
                  "complete"

                    ? "مكتمل"

                    : row.status ===
                      "open"

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


  const available = 18;


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
        () => {

          document
            .querySelectorAll(
              ".nav-btn"
            )
            .forEach(btn =>
              btn.classList.remove(
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
// LOGIN FORM
// =====================================================

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

      }

      catch (error) {

        console.error(error);

        message.textContent =
          "البريد الإلكتروني أو كلمة المرور غير صحيحة.";

      }

    }
  );


// =====================================================
// EVENTS
// =====================================================

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


// =====================================================
// INITIALIZATION
// =====================================================

async function initializeApp() {

  setupNavigation();


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

      await loadDashboard();

      await loadLeaves();

      showApp();

    }

    catch (error) {

      console.error(error);

      await supabaseClient.auth.signOut();

      showLogin();

    }

  }

  else {

    showLogin();

  }

}


initializeApp();
