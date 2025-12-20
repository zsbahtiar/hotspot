export const formatDate = (dateString: string): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

export const extractTime = (dateTimeString: string): string => {
  if (!dateTimeString) return "N/A";
  try {
    const dateObj = new Date(dateTimeString);
    if (!isNaN(dateObj.getTime())) {
      const hours = String(dateObj.getHours()).padStart(2, "0");
      const minutes = String(dateObj.getMinutes()).padStart(2, "0");
      const seconds = String(dateObj.getSeconds()).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    }

    let timePart = "";

    const spaceSplit = dateTimeString.split(" ");
    if (spaceSplit.length > 1) {
      timePart = spaceSplit[1];
    } else if (dateTimeString.includes("T")) {
      timePart = dateTimeString.slice(11, 19);
    }

    if (timePart) {
      const cleanTime = timePart.split(".")[0];
      const timeComponents = cleanTime.split(/[:.]/);

      if (timeComponents.length === 3) {
        const [h, m, s] = timeComponents;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(
          2,
          "0",
        )}:${String(s).padStart(2, "0")}`;
      }
    }
    return "N/A";
  } catch (error) {
    return "N/A";
  }
};

export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const weatherConditionsMap: Record<string, string> = {
  "Clear": "Cerah",
  "Overcast": "Mendung",
  "Partially cloudy": "Berawan Sebagian",
  "Rain": "Hujan",
  "Rain, Overcast": "Hujan, Mendung",
  "Rain, Partially cloudy": "Hujan, Berawan Sebagian",
};

export const translateWeatherCondition = (condition: string | undefined): string => {
  if (!condition) return "-";
  return weatherConditionsMap[condition] || condition;
};

export const decompressGzip = async (response: Response): Promise<any> => {
  try {
    const arrayBuffer = await response.arrayBuffer();

    if (typeof window !== "undefined" && (window as any).pako) {
      try {
        const decompressed = (window as any).pako.ungzip(
          new Uint8Array(arrayBuffer),
        );
        const text = new TextDecoder().decode(decompressed);
        return JSON.parse(text);
      } catch (pakoError) {
        console.warn(
          "Pako decompression failed, trying DecompressionStream:",
          pakoError,
        );
      }
    }

    if ("DecompressionStream" in window) {
      try {
        const decompressionStream = new DecompressionStream("gzip");
        const writer = decompressionStream.writable.getWriter();
        const reader = decompressionStream.readable.getReader();

        writer.write(new Uint8Array(arrayBuffer));
        writer.close();

        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }

        const decompressedData = new Uint8Array(
          chunks.reduce((acc, chunk) => acc + chunk.length, 0),
        );
        let offset = 0;
        for (const chunk of chunks) {
          decompressedData.set(chunk, offset);
          offset += chunk.length;
        }

        const text = new TextDecoder().decode(decompressedData);
        return JSON.parse(text);
      } catch (streamError) {
        console.warn(
          "DecompressionStream failed, trying manual decompression:",
          streamError,
        );
      }
    }

    console.warn(
      "All decompression methods failed, trying to parse as plain JSON",
    );
    const text = new TextDecoder().decode(arrayBuffer);
    return JSON.parse(text);
  } catch (error) {
    console.error("Decompression error:", error);
    throw new Error("Failed to decompress gzip data");
  }
};
