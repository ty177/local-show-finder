import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get("zip") || "10027";
  const apiKey = process.env.TICKETMASTER_API_KEY;

  // Step 1: Test zippopotam.us
  let coords = { lat: "", lon: "" };
  let zipError = "";
  try {
    const zipRes = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (zipRes.ok) {
      const zipData = await zipRes.json();
      const place = zipData?.places?.[0];
      coords = { lat: place?.latitude || "", lon: place?.longitude || "" };
    } else {
      zipError = `zippopotam status: ${zipRes.status}`;
    }
  } catch (e) {
    zipError = `zippopotam error: ${(e as Error).message}`;
  }

  // Step 2: Test Ticketmaster with those coords
  let tmTotal = 0;
  let tmError = "";
  let tmSample: string[] = [];
  try {
    const params = new URLSearchParams({
      apikey: apiKey || "missing",
      latlong: `${coords.lat},${coords.lon}`,
      radius: "40",
      unit: "miles",
      classificationName: "music",
      sort: "date,asc",
      size: "5",
    });
    const tmRes = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`
    );
    if (tmRes.ok) {
      const tmData = await tmRes.json();
      tmTotal = tmData?.page?.totalElements || 0;
      const events = tmData?._embedded?.events || [];
      tmSample = events.map(
        (e: any) =>
          `${e.name} | attractions: ${(e._embedded?.attractions || []).map((a: any) => a.name).join(", ")}`
      );
    } else {
      tmError = `TM status: ${tmRes.status} ${await tmRes.text()}`;
    }
  } catch (e) {
    tmError = `TM error: ${(e as Error).message}`;
  }

  return NextResponse.json({
    zip,
    coords,
    zipError: zipError || null,
    hasApiKey: !!apiKey,
    tmTotal,
    tmError: tmError || null,
    tmSample,
  });
}
