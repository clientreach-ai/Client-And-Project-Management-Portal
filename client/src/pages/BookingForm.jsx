import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  Clock3,
  Globe,
  Loader2,
  Send,
} from "lucide-react";
import CustomSelect from "../components/CustomSelect";
import { useMeetingLinkLookup } from "../hooks/useQueries";
import {
  useCreatePublicMeetingLink,
  useSubmitMeetingBooking,
} from "../hooks/useMutations";

const TIMEZONE = "Europe/London";
const DURATION_MINUTES = 45;
const BRAND_COLOR = "#14A3F6";
const SUCCESS_COLOR = "#10B981";

const BUSINESS_TYPES = [
  "SaaS (Software as a Service)",
  "Marketing / Advertising Agency",
  "Coaching / Consulting",
  "Online Education / Courses",
  "E-commerce (Physical Products)",
  "Local Service Business (Real Estate, Med Spa, Contractor, etc.)",
  "Financial Services",
  "Health & Wellness",
  "Personal Brand / Influencer",
  "Nonprofit Organization",
  "Other...",
];

const TARGET_AUDIENCES = [
  "B2B (Businesses)",
  "B2C (Consumers)",
  "Enterprise Companies",
  "Startups",
  "Local Customers",
  "High-Net-Worth Individuals",
  "Professionals (Doctors, Lawyers, Advisors, etc.)",
  "Entrepreneurs",
  "Women",
  "Men",
  "Parents / Families",
  "Other",
];

const MONTHLY_REVENUE_OPTIONS = [
  "$0 - $1K /mo",
  "$1k - 5K /mo",
  "$5k - 25K /mo",
  "$25k - 50K /mo",
  "$50k - 100K /mo",
  "$100k - 250K+ /mo",
];

const DECISION_MAKER_OPTIONS = [
  "Yes – I make the final decisions",
  "I share decision making with a partner",
  "No – I need approval from someone else",
];

const DEFAULT_BOOKING_START_HOUR = 9;
const DEFAULT_BOOKING_END_HOUR = 20;

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateKeyFromParts = ({ year, month, day }) => {
  const paddedMonth = `${month}`.padStart(2, "0");
  const paddedDay = `${day}`.padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
};

const fromDateKey = (dateKey) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || "");
  if (!match) return new Date();

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const formatPrettyDate = (date) =>
  date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const getTimezoneOffsetLabel = (timeZone, date = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const offsetPart = parts.find(
      (part) => part.type === "timeZoneName",
    )?.value;
    if (!offsetPart) return null;
    return offsetPart.replace("UTC", "GMT");
  } catch {
    return null;
  }
};
const getZonedDateParts = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value || 0),
    month: Number(parts.find((part) => part.type === "month")?.value || 0),
    day: Number(parts.find((part) => part.type === "day")?.value || 0),
    hour: Number(parts.find((part) => part.type === "hour")?.value || 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value || 0),
  };
};

const getDateKeyInTimezone = (date, timeZone) =>
  toDateKeyFromParts(getZonedDateParts(date, timeZone));

const buildIsoFromDateAndTime = (dateKey, time12h, timeZone = TIMEZONE) => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time12h || "");
  if (!match) return null;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || "");
  if (!dateMatch) return null;

  const [, yearValue, monthValue, dayValue] = dateMatch;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  let utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  for (let index = 0; index < 3; index += 1) {
    const zoned = getZonedDateParts(utcDate, timeZone);
    const targetValue = Date.UTC(year, month - 1, day, hours, minutes);
    const zonedValue = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
    );

    const diffMinutes = Math.round((targetValue - zonedValue) / 60000);
    if (diffMinutes === 0) {
      return utcDate.toISOString();
    }

    utcDate = new Date(utcDate.getTime() + diffMinutes * 60 * 1000);
  }

  return utcDate.toISOString();
};

const to12HourLabel = (hour) => {
  const date = new Date(2000, 0, 1, hour, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const buildTimeSlots = (startHour, endHour) => {
  const safeStart = Number.isFinite(startHour)
    ? Math.max(0, Math.min(23, Math.trunc(startHour)))
    : DEFAULT_BOOKING_START_HOUR;
  const safeEnd = Number.isFinite(endHour)
    ? Math.max(0, Math.min(23, Math.trunc(endHour)))
    : DEFAULT_BOOKING_END_HOUR;

  const rangeStart = Math.min(safeStart, safeEnd);
  const rangeEnd = Math.max(safeStart, safeEnd);

  const slots = [];
  for (let hour = rangeStart; hour <= rangeEnd; hour += 1) {
    slots.push(to12HourLabel(hour));
  }

  return slots;
};

const BookingForm = () => {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get("token");
  const workspaceIdParam = searchParams.get("workspaceId");

  const [bookingToken, setBookingToken] = useState(tokenParam);
  const [publicInitError, setPublicInitError] = useState(null);
  const [step, setStep] = useState("schedule");

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateKey(new Date()),
  );
  const [selectedTime, setSelectedTime] = useState("");

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    website_url: "",
    business_type: "",
    target_audience: "",
    monthly_revenue: "",
    decision_maker: "",
  });

  const [errors, setErrors] = useState({});

  const {
    data: bookingMeta,
    isLoading,
    isError,
  } = useMeetingLinkLookup(bookingToken, {
    enabled: Boolean(bookingToken),
    retry: false,
  });

  const { mutateAsync: createPublicMeetingLink, isPending: isPublicPending } =
    useCreatePublicMeetingLink();
  const { mutateAsync: submitMeetingBooking, isPending: submitting } =
    useSubmitMeetingBooking();

  useEffect(() => {
    setBookingToken(tokenParam);
  }, [tokenParam]);

  useEffect(() => {
    let isActive = true;

    const initializePublicBooking = async () => {
      if (tokenParam || bookingToken || !workspaceIdParam) return;

      try {
        const result = await createPublicMeetingLink({
          workspaceId: workspaceIdParam,
        });
        if (isActive) {
          setBookingToken(result?.token || null);
          setPublicInitError(null);
        }
      } catch (error) {
        if (isActive) {
          setPublicInitError(error?.message || "Failed to start booking form");
        }
      }
    };

    initializePublicBooking();

    return () => {
      isActive = false;
    };
  }, [tokenParam, bookingToken, workspaceIdParam, createPublicMeetingLink]);

  const selectedDate = useMemo(() => {
    const parsed = fromDateKey(selectedDateKey);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [selectedDateKey]);

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < offset; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      cells.push({
        day,
        key: toDateKey(date),
      });
    }

    return cells;
  }, [currentMonth]);

  const selectedDateLabel = formatPrettyDate(selectedDate);
  const duration = bookingMeta?.durationMinutes || DURATION_MINUTES;
  const timezone = TIMEZONE;
  const todayDateKey = useMemo(
    () => getDateKeyInTimezone(new Date(), timezone),
    [timezone],
  );
  const timeSlots = useMemo(
    () =>
      buildTimeSlots(
        bookingMeta?.startHour ?? DEFAULT_BOOKING_START_HOUR,
        bookingMeta?.endHour ?? DEFAULT_BOOKING_END_HOUR,
      ),
    [bookingMeta?.startHour, bookingMeta?.endHour],
  );
  const timezoneOffsetLabel = useMemo(
    () => getTimezoneOffsetLabel(timezone, selectedDate),
    [timezone, selectedDate],
  );
  const disabledTimes = useMemo(() => {
    if (!selectedDateKey || selectedDateKey > todayDateKey) {
      return new Set();
    }

    const nowTimestamp = Date.now();
    return new Set(
      timeSlots.filter((time) => {
        const slotIso = buildIsoFromDateAndTime(
          selectedDateKey,
          time,
          timezone,
        );
        if (!slotIso) return true;
        const slotTimestamp = new Date(slotIso).getTime();
        return !Number.isFinite(slotTimestamp) || slotTimestamp <= nowTimestamp;
      }),
    );
  }, [selectedDateKey, timeSlots, timezone, todayDateKey]);

  useEffect(() => {
    if (selectedDateKey < todayDateKey) {
      setSelectedDateKey(todayDateKey);
    }
  }, [selectedDateKey, todayDateKey]);

  useEffect(() => {
    if (!selectedTime) return;
    if (disabledTimes.has(selectedTime)) {
      setSelectedTime("");
    }
  }, [selectedTime, disabledTimes]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateDetails = () => {
    const nextErrors = {};

    if (!formData.first_name.trim()) nextErrors.first_name = "Required";
    if (!formData.last_name.trim()) nextErrors.last_name = "Required";
    if (!formData.phone.trim()) {
      nextErrors.phone = "Required";
    } else if (!/^[+]?[-()\d\s]{7,20}$/.test(formData.phone.trim())) {
      nextErrors.phone = "Invalid phone number";
    }

    if (!formData.email.trim()) {
      nextErrors.email = "Required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nextErrors.email = "Invalid email";
    }

    if (!formData.website_url.trim()) {
      nextErrors.website_url = "Required";
    } else if (!/^https?:\/\/.+/i.test(formData.website_url.trim())) {
      nextErrors.website_url = "Website must start with http:// or https://";
    }

    if (!formData.business_type) nextErrors.business_type = "Required";
    if (!formData.target_audience) nextErrors.target_audience = "Required";
    if (!formData.monthly_revenue) nextErrors.monthly_revenue = "Required";
    if (!formData.decision_maker) nextErrors.decision_maker = "Required";

    if (!selectedTime) nextErrors.selected_time = "Please select a time";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateDetails()) return;

    const scheduledAt = buildIsoFromDateAndTime(
      selectedDateKey,
      selectedTime,
      TIMEZONE,
    );
    if (!scheduledAt) {
      toast.error("Invalid selected time");
      return;
    }

    const scheduledAtTimestamp = new Date(scheduledAt).getTime();
    if (
      !Number.isFinite(scheduledAtTimestamp) ||
      scheduledAtTimestamp <= Date.now()
    ) {
      toast.error("Please select a future date and time");
      return;
    }

    const toastId = toast.loading("Scheduling meeting...");
    try {
      await submitMeetingBooking({
        token: bookingToken,
        payload: {
          ...formData,
          timezone,
          duration_minutes: duration,
          scheduled_at: scheduledAt,
        },
      });
      toast.success("Meeting scheduled successfully", { id: toastId });
      setStep("success");
    } catch (error) {
      toast.error(error?.message || "Failed to schedule meeting", {
        id: toastId,
      });
    }
  };

  if (!bookingToken && !workspaceIdParam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4 text-white">
        <div className="max-w-lg w-full p-8 text-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md">
          <h1 className="text-2xl font-semibold">Invalid booking link</h1>
          <p className="text-sm text-gray-400 mt-2">
            Please request a valid booking link.
          </p>
        </div>
      </div>
    );
  }

  if (!bookingToken && workspaceIdParam && !publicInitError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-gray-300">
        Preparing booking page...
      </div>
    );
  }

  if (publicInitError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4 text-white">
        <div className="max-w-lg w-full p-8 text-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md">
          <h1 className="text-2xl font-semibold">Invalid booking link</h1>
          <p className="text-sm text-gray-400 mt-2">{publicInitError}</p>
        </div>
      </div>
    );
  }

  if (isLoading || isPublicPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-gray-300">
        Loading booking page...
      </div>
    );
  }

  if (isError || !bookingMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4 text-white">
        <div className="max-w-lg w-full p-8 text-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md">
          <h1 className="text-2xl font-semibold">Invalid booking link</h1>
          <p className="text-sm text-gray-400 mt-2">
            This booking link is invalid or expired.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#FFFFFD] flex flex-col items-center justify-center py-4 px-3 sm:py-6 sm:px-6">
      <div className="mb-5 sm:mb-8">
        <div className="flex items-center gap-4">
          <img
            src="/clientreachai.logo.png"
            alt="ClientReach.ai Logo"
            className="h-10 sm:h-14 w-auto object-contain"
          />
          <div className="flex flex-col leading-none -ml-3">
            <span className="text-2xl sm:text-3xl font-bold text-white">
              Client
            </span>
            <span className="text-2xl sm:text-3xl font-bold text-white -mt-1.5 sm:-mt-2">
              Reach
              <span
                className="transition-all duration-300 hover:drop-shadow-[0_0_15px_rgba(20,163,246,0.8)]"
                style={{ color: BRAND_COLOR }}
              >
                .ai
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl">
        {(step === "schedule" || step === "details") && (
          <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr]">
              <aside className="border-b md:border-b-0 md:border-r border-white/10 p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
                <button
                  type="button"
                  onClick={() => {
                    if (step === "details") setStep("schedule");
                  }}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/20 inline-flex items-center justify-center hover:border-white/40 transition-colors"
                >
                  <ArrowLeft
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    style={{ color: BRAND_COLOR }}
                  />
                </button>

                <div className="space-y-2.5 sm:space-y-3 text-sm sm:text-base text-gray-300">
                  <div className="flex items-center gap-3">
                    <Clock3 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <span className="font-medium">{duration} Mins</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <span>
                      {selectedTime
                        ? `${selectedTime} - ${selectedDateLabel}`
                        : selectedDateLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <span>
                      {timezoneOffsetLabel
                        ? `${timezone} (${timezoneOffsetLabel})`
                        : timezone}
                    </span>
                  </div>
                </div>
              </aside>

              <main className="p-4 sm:p-6 md:p-8">
                {step === "schedule" && (
                  <div className="space-y-5 sm:space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      <h2 className="text-2xl sm:text-3xl font-bold text-white">
                        Select Date & Time
                      </h2>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentMonth(
                              (prev) =>
                                new Date(
                                  prev.getFullYear(),
                                  prev.getMonth() - 1,
                                  1,
                                ),
                            )
                          }
                          className="w-8 h-8 rounded-full border border-white/20 text-gray-300 hover:border-white/40"
                        >
                          ‹
                        </button>
                        <p className="font-medium text-sm sm:text-base text-gray-200">
                          {monthLabel}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentMonth(
                              (prev) =>
                                new Date(
                                  prev.getFullYear(),
                                  prev.getMonth() + 1,
                                  1,
                                ),
                            )
                          }
                          className="w-8 h-8 rounded-full text-white"
                          style={{ backgroundColor: `${BRAND_COLOR}33` }}
                        >
                          ›
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
                      <div>
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs sm:text-sm text-gray-500 mb-2">
                          {[
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                          ].map((label) => (
                            <div key={label}>{label}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                          {calendarDays.map((cell, index) => {
                            if (!cell) {
                              return (
                                <div
                                  key={`blank-${index}`}
                                  className="h-9 sm:h-10 rounded-md"
                                />
                              );
                            }

                            const isSelected = selectedDateKey === cell.key;
                            const isPastDate = cell.key < todayDateKey;
                            return (
                              <button
                                key={cell.key}
                                type="button"
                                onClick={() => setSelectedDateKey(cell.key)}
                                disabled={isPastDate}
                                className={`h-9 sm:h-10 rounded-full text-xs sm:text-sm transition border ${
                                  isSelected
                                    ? "text-white border-transparent font-semibold"
                                    : isPastDate
                                      ? "border-white/20 text-gray-500 cursor-not-allowed bg-white/1"
                                      : "border-white/15 text-gray-300 hover:border-white/40"
                                }`}
                                style={
                                  isSelected
                                    ? { backgroundColor: BRAND_COLOR }
                                    : undefined
                                }
                              >
                                {cell.day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="max-h-[258px] overflow-y-auto pr-1 space-y-3">
                          {timeSlots.map((time) => {
                            const isDisabled = disabledTimes.has(time);
                            return (
                              <button
                                key={time}
                                type="button"
                                onClick={() => setSelectedTime(time)}
                                disabled={isDisabled}
                                className={`w-full border rounded-xl py-3 text-center font-semibold transition ${
                                  selectedTime === time
                                    ? "text-white border-transparent"
                                    : isDisabled
                                      ? "text-gray-400 border-white/20 cursor-not-allowed bg-white/5"
                                      : "text-gray-200 border-white/20 hover:border-white/40 hover:bg-white/5"
                                }`}
                                style={
                                  selectedTime === time
                                    ? { backgroundColor: BRAND_COLOR }
                                    : undefined
                                }
                              >
                                {time}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          disabled={!selectedTime}
                          onClick={() => setStep("details")}
                          className="w-full mt-2 py-3 rounded-xl text-white font-semibold disabled:opacity-40"
                          style={{ backgroundColor: BRAND_COLOR }}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {step === "details" && (
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-5 text-sm sm:text-base"
                  >
                    <div className="mb-1">
                      <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-white">
                        Enter Details
                      </h2>
                      <p className="text-sm sm:text-base text-gray-400">
                        Complete your information to book the meeting.
                      </p>
                    </div>

                    <div className="space-y-5 max-h-[65vh] sm:max-h-140 overflow-y-auto pr-0 sm:pr-1">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={formData.first_name}
                          onChange={(event) =>
                            updateField("first_name", event.target.value)
                          }
                          className={`w-full bg-white/5 border ${
                            errors.first_name
                              ? "border-red-500"
                              : "border-white/10"
                          } rounded-xl px-4 py-3 focus:outline-none focus:border-[#14A3F6] transition-all hover:bg-white/10`}
                          placeholder="First Name"
                        />
                        {errors.first_name && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.first_name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={formData.last_name}
                          onChange={(event) =>
                            updateField("last_name", event.target.value)
                          }
                          className={`w-full bg-white/5 border ${
                            errors.last_name
                              ? "border-red-500"
                              : "border-white/10"
                          } rounded-xl px-4 py-3 focus:outline-none focus:border-[#14A3F6] transition-all hover:bg-white/10`}
                          placeholder="Last Name"
                        />
                        {errors.last_name && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.last_name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          Phone *
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(event) =>
                            updateField("phone", event.target.value)
                          }
                          className={`w-full bg-white/5 border ${
                            errors.phone ? "border-red-500" : "border-white/10"
                          } rounded-xl px-4 py-3 focus:outline-none focus:border-[#14A3F6] transition-all hover:bg-white/10`}
                          placeholder="Phone"
                        />
                        {errors.phone && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.phone}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(event) =>
                            updateField("email", event.target.value)
                          }
                          className={`w-full bg-white/5 border ${
                            errors.email ? "border-red-500" : "border-white/10"
                          } rounded-xl px-4 py-3 focus:outline-none focus:border-[#14A3F6] transition-all hover:bg-white/10`}
                          placeholder="Email"
                        />
                        {errors.email && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.email}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          Website URL *
                        </label>
                        <input
                          type="text"
                          value={formData.website_url}
                          onChange={(event) =>
                            updateField("website_url", event.target.value)
                          }
                          className={`w-full bg-white/5 border ${
                            errors.website_url
                              ? "border-red-500"
                              : "border-white/10"
                          } rounded-xl px-4 py-3 focus:outline-none focus:border-[#14A3F6] transition-all hover:bg-white/10`}
                          placeholder="https://example.com"
                        />
                        {errors.website_url && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.website_url}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          What type of business are you? *
                        </label>
                        <CustomSelect
                          value={formData.business_type}
                          onChange={(value) =>
                            updateField("business_type", value)
                          }
                          options={BUSINESS_TYPES}
                          hasError={Boolean(errors.business_type)}
                        />
                        {errors.business_type && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.business_type}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          Who is your primary target audience? *
                        </label>
                        <CustomSelect
                          value={formData.target_audience}
                          onChange={(value) =>
                            updateField("target_audience", value)
                          }
                          options={TARGET_AUDIENCES}
                          hasError={Boolean(errors.target_audience)}
                        />
                        {errors.target_audience && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.target_audience}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          What is your current average monthly revenue? *
                        </label>
                        <CustomSelect
                          value={formData.monthly_revenue}
                          onChange={(value) =>
                            updateField("monthly_revenue", value)
                          }
                          options={MONTHLY_REVENUE_OPTIONS}
                          hasError={Boolean(errors.monthly_revenue)}
                        />
                        {errors.monthly_revenue && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.monthly_revenue}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="block text-sm font-medium text-gray-300 mb-2">
                          Are you the primary decision maker for your business?
                          *
                        </p>
                        <div className="space-y-2.5">
                          {DECISION_MAKER_OPTIONS.map((option) => {
                            const isSelected =
                              formData.decision_maker === option;

                            return (
                              <label
                                key={option}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer border transition-all ${
                                  isSelected
                                    ? "border-[#14A3F6] bg-[#14A3F6]/10 shadow-[0_0_16px_rgba(20,163,246,0.2)]"
                                    : "border-white/10 hover:border-white/30 hover:bg-white/5"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="decision_maker"
                                  checked={isSelected}
                                  onChange={() =>
                                    updateField("decision_maker", option)
                                  }
                                  className="h-4 w-4 shrink-0 accent-[#14A3F6] cursor-pointer"
                                />
                                <span
                                  className={`text-sm leading-relaxed ${
                                    isSelected ? "text-white" : "text-gray-300"
                                  }`}
                                >
                                  {option}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {errors.decision_maker && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.decision_maker}
                          </p>
                        )}
                      </div>

                      {errors.selected_time && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.selected_time}
                        </p>
                      )}
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full sm:w-auto text-white py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: BRAND_COLOR,
                          boxShadow: `0 10px 30px -10px ${BRAND_COLOR}80`,
                        }}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Scheduling...
                          </>
                        ) : (
                          <>
                            Schedule Meeting <Send className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </main>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl text-center max-w-xl mx-auto border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_20px_rgba(49,145,196,0.3)]">
            <div className="flex justify-center mb-5 sm:mb-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border border-[#10B981]/20 bg-[#10B981]/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CheckCircle
                  className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]"
                  style={{ color: SUCCESS_COLOR }}
                />
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">
              Meeting Scheduled
            </h2>
            <p className="text-base sm:text-lg text-gray-400 mb-0 sm:mb-8 leading-relaxed">
              We received your booking for {selectedDateLabel} at {selectedTime}
              .
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 sm:mt-12 text-center text-gray-600 text-xs">
        <p>
          &copy; {new Date().getFullYear()} ClientReach.ai. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default BookingForm;
