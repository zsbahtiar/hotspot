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
            "0"
          )}:${String(s).padStart(2, "0")}`;
        }
      }
      return "N/A";
    } catch (error) {
      console.error("Error formatting time in extractTime:", error);
      return "N/A";
    }
  };

export const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };