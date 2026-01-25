const PANAMA_TIME_ZONE = "America/Panama";

const getDatePartsInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
};

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const zonedDate = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
  );

  return (zonedDate.getTime() - date.getTime()) / 60000;
};

const zonedTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
) => {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcDate, timeZone);
  return new Date(utcDate.getTime() - offsetMinutes * 60000);
};

export const getPanamaTodayDateString = () => {
  const parts = getDatePartsInTimeZone(new Date(), PANAMA_TIME_ZONE);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");

  return `${parts.year}-${month}-${day}`;
};

export const getPanamaDayRange = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const start = zonedTimeToUtc(year, month, day, 0, 0, 0, PANAMA_TIME_ZONE);
  const end = zonedTimeToUtc(year, month, day + 1, 0, 0, 0, PANAMA_TIME_ZONE);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export const formatPanamaDateLabel = (value: string) => {
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};
