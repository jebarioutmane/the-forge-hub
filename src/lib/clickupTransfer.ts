const CLICKUP_BASE = "https://forms.clickup.com/9012832839/f/8ck9uj7-3132/HD1ZGCFGBHUA8T795Y";

interface TransferData {
  personName?: string;
  personEmail?: string;
  travelType?: string;
  arrivalDate?: string;
  departureDate?: string;
  departureCity?: string;
  arrivalCity?: string;
  arrivalFlightNumber?: string;
  departureFlightNumber?: string;
  accommodationType?: string;
  housingArrivalDate?: string;
  housingDepartureDate?: string;
  numberOfPassengers?: string;
  allPassengerNames?: string;
  eventName?: string;
  budgetLine?: string;
  comments?: string;
}

export function buildClickUpUrl(data: TransferData): string {
  const params = new URLSearchParams();

  const map: [string, string | undefined][] = [
    ["Full Name of Traveler", data.personName],
    ["Traveler Email", data.personEmail],
    ["Travel Type Required", data.travelType],
    ["Arrival Date", data.arrivalDate],
    ["Departure Date", data.departureDate],
    ["Departure City", data.departureCity],
    ["Arrival City", data.arrivalCity],
    ["Preferred Arrival Flight Number", data.arrivalFlightNumber],
    ["Preferred Departure Flight Number", data.departureFlightNumber],
    ["Accommodation Type", data.accommodationType],
    ["Verify date of arrival for housing", data.housingArrivalDate],
    ["Verify date of departure for housing", data.housingDepartureDate],
    ["Number of Passengers", data.numberOfPassengers],
    ["All names of passengers", data.allPassengerNames],
    ["Event Name or Travel Reason", data.eventName],
    ["Budget Line", data.budgetLine],
    ["Comments or notes", data.comments],
  ];

  for (const [key, value] of map) {
    if (value) params.set(key, value);
  }

  return `${CLICKUP_BASE}?${params.toString()}`;
}
