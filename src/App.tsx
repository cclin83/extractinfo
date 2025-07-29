import React, { useState, useCallback, useEffect } from "react";

// Main App component
function App() {
  // State to store the extracted data.
  // It will be an array of objects, where each object represents a file's data.
  // Each object will have a 'fileName' and a 'fields' object containing the extracted key-value pairs.
  const [extractedData, setExtractedData] = useState([]);
  // State for loading indicator
  const [loading, setLoading] = useState(false);
  // State for error messages
  const [error, setError] = useState("");
  // State for selected fields to display in the table
  const [selectedFields, setSelectedFields] = useState([]);
  // State to store the names of the files currently selected by the user
  const [selectedFileNames, setSelectedFileNames] = useState([]);

  // Define all possible fields (row headers in the new transposed view)
  const allFields = [
    "Reference",
    "MOA",
    "Molecule/Intervention Route",
    "Phase",
    "Sample Size",
    "Treatment Arms",
    "Background Therapy",
    "Duration",
    "Inclusion Criteria",
    "Age",
    "BMI",
    "T2DM Included?",
    "T2DM Definition",
    "Established CVD Definition",
    "CKD Included?",
    "CKD Definition",
    "HFpEF Included?",
    "HFpEF Definition",
    "Exclusion Criteria",
    "T2DM and/or T1DM excluded?",
    "History of CV events definition and timing for exclusion",
    "Con med exclusion: definition and timing?",
    "Uncontrolled HTN, BP cutoffs",
    "NYHA class",
    "Liver disease",
    "CKD eGFR cutoff, dialysis or kidney transplant",
    "Primary Endpoint",
    "Key Secondary Endpoints",
    "Other Secondary Endpoints",
    "Exploratory Endpoints",
    "Substudies (if available)",
    "Notes/Comments",
    "Study ID",
  ];

  // Initialize selectedFields with allFields when the component mounts
  useEffect(() => {
    setSelectedFields(allFields);
  }, []); // Empty dependency array means this runs once on mount

  // Function to extract specific fields from a single JSON object
  const extractInfo = useCallback((jsonData) => {
    const protocolSection = jsonData?.protocolSection;
    if (!protocolSection) {
      console.warn("JSON file is missing 'protocolSection'.");
      return {};
    }

    const identificationModule = protocolSection.identificationModule;
    const statusModule = protocolSection.statusModule;
    // Ensure descriptionModule exists or provide a default empty object
    const descriptionModule = protocolSection.descriptionModule || {};
    const designModule = protocolSection.designModule;
    const armsInterventionsModule = protocolSection.armsInterventionsModule;
    const eligibilityModule = protocolSection.eligibilityModule;
    const outcomesModule = protocolSection.outcomesModule;
    const derivedSection = jsonData?.derivedSection;

    // Helper to safely get text from a path, returning empty string if not found
    const getSafeText = (path, defaultValue = "") => {
      let current = jsonData;
      for (const key of path.split(".")) {
        if (current === undefined || current === null) {
          return defaultValue;
        }
        current = current[key];
      }
      return current !== undefined && current !== null
        ? String(current)
        : defaultValue;
    };

    // Helper to format intervention details
    const formatInterventions = (arms) => {
      if (!arms || arms.length === 0) return "";
      return arms
        .map((arm) => {
          const name = arm.label || "N/A";
          const description = arm.description || "";
          const interventions = arm.interventionNames
            ? arm.interventionNames
                .map((i) => i.replace("Drug: ", ""))
                .join(", ")
            : "N/A";
          return `- **${name}**: ${description} (Interventions: ${interventions})`;
        })
        .join("<br>");
    };

    // Helper to format outcome measures
    const formatOutcomes = (outcomes) => {
      if (!outcomes || outcomes.length === 0) return "";
      return outcomes
        .map(
          (outcome) =>
            `- **${outcome.title || "N/A"}**: ${
              outcome.description || "N/A"
            } (Time Frame: ${outcome.timeFrame || "N/A"})`
        )
        .join("<br>");
    };

    const inclusionCriteriaText = eligibilityModule?.eligibilityCriteria || "";
    const exclusionCriteriaText = eligibilityModule?.eligibilityCriteria || ""; // Same source, will parse specific parts

    // Improved MOA extraction logic
    let moa = "Not explicitly stated";
    if (derivedSection?.interventionBrowseModule?.meshTerms?.length > 0) {
      // Prioritize Mesh Terms if available
      moa = derivedSection.interventionBrowseModule.meshTerms
        .map((term) => term.term)
        .join(", ");
    } else if (
      derivedSection?.interventionBrowseModule?.ancestors?.length > 0
    ) {
      // Fallback to ancestors if Mesh Terms are not available
      moa = derivedSection.interventionBrowseModule.ancestors
        .map((ancestor) => ancestor.term)
        .join(", ");
    }

    // Extract Exploratory Endpoints
    const exploratoryEndpoints =
      outcomesModule?.exploratoryOutcomes?.length > 0
        ? formatOutcomes(outcomesModule.exploratoryOutcomes)
        : "Not explicitly listed in the provided data.";

    // Extract Substudies
    const substudies =
      designModule?.substudies?.length > 0
        ? designModule.substudies
            .map(
              (sub) =>
                `- **${sub.title || "N/A"}**: ${sub.description || "N/A"}`
            )
            .join("<br>")
        : "Not explicitly listed in the provided data.";

    const extractedFields = {
      Reference: identificationModule?.nctId || "",
      MOA: moa, // Updated MOA extraction
      "Molecule/Intervention Route":
        armsInterventionsModule?.interventions?.[0]?.name &&
        armsInterventionsModule?.interventions?.[0]?.description
          ? `${armsInterventionsModule.interventions[0].name}, ${
              armsInterventionsModule.interventions[0].description.split(".")[0]
            }`
          : "",
      Phase: designModule?.phases?.[0] || "",
      "Sample Size": designModule?.enrollmentInfo?.count || "",
      "Treatment Arms": formatInterventions(armsInterventionsModule?.armGroups),
      "Background Therapy": descriptionModule?.briefSummary?.includes(
        "add-on to the standard-of-care treatment"
      )
        ? "Add-on to standard-of-care treatment."
        : "Not explicitly stated.",
      Duration:
        getSafeText("statusModule.completionDateStruct.date") &&
        getSafeText("statusModule.startDateStruct.date")
          ? `From ${getSafeText(
              "statusModule.startDateStruct.date"
            )} to ${getSafeText("statusModule.completionDateStruct.date")}`
          : getSafeText("descriptionModule.briefSummary")?.match(
              /The study will last for about ([\d\.-]+ to [\d\.-]+ years)/
            )?.[1] ||
            getSafeText("descriptionModule.briefSummary")?.match(
              /The trial duration is approximately ([\d\.-]+ to [\d\.-]+ years)/
            )?.[1] ||
            getSafeText("descriptionModule.briefSummary")?.match(
              /The study will last for about ([\d\.-]+ to [\d\.-]+ months)/
            )?.[1] ||
            getSafeText("outcomesModule.primaryOutcomes.0.timeFrame")
              ?.replace("Approximate Maximum ", "")
              .replace("Months", " months") ||
            getSafeText("descriptionModule.briefSummary")?.match(
              /up to max\. (\d+ weeks)/
            )?.[1] ||
            "",
      "Inclusion Criteria": inclusionCriteriaText
        .split("Exclusion Criteria:")[0]
        .replace("Inclusion Criteria:\n\n", "")
        .replace(/\n\* /g, "<br>- ")
        .trim(),
      Age: eligibilityModule?.minimumAge || "",
      BMI:
        eligibilityModule?.eligibilityCriteria?.match(
          /Body mass index \(BMI\) ([^\n]+)/
        )?.[1] || "Not explicitly mentioned.",
      "T2DM Included?":
        protocolSection?.conditionsModule?.conditions?.includes(
          "Diabetes Mellitus, Type 2"
        ) || inclusionCriteriaText.includes("type 2 diabetes mellitus")
          ? "Yes"
          : "No",
      "T2DM Definition":
        protocolSection?.conditionsModule?.conditions?.includes(
          "Diabetes Mellitus, Type 2"
        ) || inclusionCriteriaText.includes("type 2 diabetes mellitus")
          ? "Type 2 diabetes mellitus"
          : "Not applicable",
      "Established CVD Definition":
        inclusionCriteriaText.match(
          /Have established cardiovascular \(CV\) disease as evidenced by ([^\n]+)/
        )?.[1] ||
        inclusionCriteriaText.match(
          /clinical evidence of cardiovascular disease or age above or equal to 60 years at screening and subclinical evidence of cardiovascular disease/
        )?.[0] ||
        "Not explicitly stated.",
      "CKD Included?": inclusionCriteriaText.includes(
        "Chronic kidney disease defined as:"
      )
        ? "Yes"
        : "Not explicitly stated.",
      "CKD Definition":
        inclusionCriteriaText.match(
          /Chronic kidney disease defined as: ([^\n]+)/
        )?.[1] || "Not explicitly stated.",
      "HFpEF Included?": inclusionCriteriaText.includes(
        "Heart failure with preserved ejection fraction (HFpEF)"
      )
        ? "Yes"
        : "Not explicitly stated.",
      "HFpEF Definition":
        inclusionCriteriaText.match(
          /Heart failure with preserved ejection fraction \(HFpEF\) defined as: ([^\n]+)/
        )?.[1] || "Not explicitly stated.",
      "Exclusion Criteria":
        exclusionCriteriaText
          .split("Exclusion Criteria:")[1]
          ?.replace(/\n\* /g, "<br>- ")
          .trim() || "",
      "T2DM and/or T1DM excluded?": exclusionCriteriaText.includes(
        "Type 1 diabetes mellitus"
      )
        ? "Type 1 diabetes mellitus excluded."
        : exclusionCriteriaText.includes("History of type 1 or type 2 diabetes")
        ? "History of type 1 or type 2 diabetes excluded."
        : "Not explicitly stated.",
      "History of CV events definition and timing for exclusion":
        exclusionCriteriaText.match(
          /Any of the following: myocardial infarction, stroke, hospitalisation for unstable angina pectoris or transient ischaemic attack within the past (\d+ days) prior to the day of screening/
        )?.[0] ||
        exclusionCriteriaText.match(
          /Acute coronary or cerebro-vascular event within (\d+ days) prior to randomisation/
        )?.[0] ||
        "Not explicitly stated.",
      "Con med exclusion: definition and timing?":
        exclusionCriteriaText
          .match(
            /Treatment with (any glucagon-like peptide-1 receptor agonist|glucose-lowering agents|any dipeptidyl peptidase 4 \(DPP-IV\) inhibitor) within (\d+ days) before screening/g
          )
          ?.join("<br>") || "Not explicitly stated.",
      "Uncontrolled HTN, BP cutoffs":
        exclusionCriteriaText.match(
          /Uncontrolled hypertension defined as systolic blood pressure >(\d+) mmHg or diastolic blood pressure >(\d+) mmHg/
        )?.[0] || "Not explicitly mentioned.",
      "NYHA class":
        exclusionCriteriaText.match(
          /Chronic heart failure New York Heart Association \(NYHA\) class IV/
        )?.[0] ||
        exclusionCriteriaText.match(
          /Presently classified as being in New York Heart Association \(NYHA\) Class IV heart failure/
        )?.[0] ||
        "Not explicitly stated.",
      "Liver disease":
        exclusionCriteriaText.includes(
          "History or presence of chronic pancreatitis"
        ) ||
        exclusionCriteriaText.includes(
          "Presence of acute pancreatitis within the past 180 days"
        )
          ? "History or presence of chronic pancreatitis and/or acute pancreatitis within the past 180 days prior to screening."
          : "Not explicitly stated.",
      "CKD eGFR cutoff, dialysis or kidney transplant":
        exclusionCriteriaText.includes(
          "End stage renal disease or chronic or intermittent haemodialysis or peritoneal dialysis"
        )
          ? "End stage renal disease or chronic or intermittent haemodialysis or peritoneal dialysis is an exclusion criterion."
          : "Not explicitly stated.",
      "Primary Endpoint": outcomesModule?.primaryOutcomes?.[0]?.title || "",
      // Added null check for o.title before calling toLowerCase()
      "Key Secondary Endpoints": formatOutcomes(
        outcomesModule?.secondaryOutcomes?.filter(
          (o) =>
            o.title &&
            (o.title.toLowerCase().includes("time to") ||
              o.title.toLowerCase().includes("first occurrence"))
        )
      ),
      // Added null check for o.title before calling toLowerCase()
      "Other Secondary Endpoints": formatOutcomes(
        outcomesModule?.secondaryOutcomes?.filter(
          (o) =>
            o.title &&
            !o.title.toLowerCase().includes("time to") &&
            !o.title.toLowerCase().includes("first occurrence")
        )
      ),
      "Exploratory Endpoints": exploratoryEndpoints, // Updated extraction
      "Substudies (if available)": substudies, // Updated extraction
      "Notes/Comments": descriptionModule?.briefSummary || "",
      "Study ID": identificationModule?.nctId || "",
    };

    return extractedFields;
  }, []);

  // Handle file selection
  const handleFileChange = async (event) => {
    const files = event.target.files;
    if (files.length === 0) {
      setExtractedData([]);
      setSelectedFileNames([]); // Clear selected file names
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    const newExtractedData = [];
    const newSelectedFileNames = [];

    for (const file of files) {
      try {
        const fileContent = await readFileAsText(file);
        const jsonData = JSON.parse(fileContent);
        const extractedInfo = extractInfo(jsonData);
        newExtractedData.push({ fileName: file.name, fields: extractedInfo });
        newSelectedFileNames.push(file.name); // Add file name to the list
      } catch (e) {
        console.error(`Error processing file ${file.name}:`, e);
        setError(
          (prev) => prev + `Error processing ${file.name}: ${e.message}. `
        );
      }
    }

    setExtractedData(newExtractedData); // Update extracted data
    setSelectedFileNames(newSelectedFileNames); // Update selected file names state
    setLoading(false);
  };

  // Helper function to read file content as text
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  // Handle changes in the multi-select dropdown
  const handleFieldSelectionChange = (event) => {
    const { options } = event.target;
    const selectedValues = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedValues.push(options[i].value);
      }
    }
    setSelectedFields(selectedValues);
  };

  // Function to export data to Excel
  const exportToExcel = () => {
    if (extractedData.length === 0) {
      setError("No data to export. Please upload JSON files first.");
      return;
    }

    // Create a temporary table element to construct the HTML for export
    const table = document.createElement("table");
    table.style.width = "100%";
    table.setAttribute("border", "1");
    table.setAttribute("cellpadding", "5");
    table.setAttribute("cellspacing", "0");

    // Create table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    // Add "Field" header
    const fieldHeader = document.createElement("th");
    fieldHeader.textContent = "Field";
    fieldHeader.style.backgroundColor = "#e2e8f0"; // Tailwind gray-200
    fieldHeader.style.padding = "12px 24px";
    fieldHeader.style.textAlign = "left";
    headerRow.appendChild(fieldHeader);

    // Add file names as headers
    extractedData.forEach((data) => {
      const th = document.createElement("th");
      th.textContent = data.fileName;
      th.style.backgroundColor = "#e2e8f0"; // Tailwind gray-200
      th.style.padding = "12px 24px";
      th.style.textAlign = "left";
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement("tbody");
    selectedFields.forEach((field) => {
      const row = document.createElement("tr");

      // Add field name cell
      const fieldCell = document.createElement("th");
      fieldCell.textContent = field;
      fieldCell.style.fontWeight = "bold";
      fieldCell.style.padding = "16px 24px";
      fieldCell.style.whiteSpace = "nowrap";
      fieldCell.style.textAlign = "left";
      fieldCell.style.backgroundColor = "#ffffff"; // Tailwind white
      fieldCell.style.borderRight = "1px solid #e2e8f0"; // Tailwind gray-200
      row.appendChild(fieldCell);

      // Add data cells for each file
      extractedData.forEach((data) => {
        const td = document.createElement("td");
        // Use innerHTML to preserve basic formatting (like <br>)
        td.innerHTML = data.fields[field] || "";
        td.style.padding = "16px 24px";
        td.style.borderLeft = "1px solid #e2e8f0"; // Tailwind gray-200
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    // Create a Blob from the HTML table
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>Clinical Trial Data</title>
      </head>
      <body>
          ${table.outerHTML}
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel" });

    // Create a download link and trigger the download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clinical_trial_data.xls"; // Use .xls for broader compatibility with HTML content
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Clean up the URL object
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 mb-6 text-center">
          Clinical Trial Data Extractor
        </h1>

        <div className="mb-8 p-4 border border-gray-300 rounded-lg bg-gray-50">
          <label
            htmlFor="json-upload"
            className="block text-lg font-medium text-gray-700 mb-3"
          >
            Upload JSON Files:
          </label>
          <input
            type="file"
            id="json-upload"
            accept=".json"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 cursor-pointer"
          />
          {selectedFileNames.length > 0 && (
            <div className="mt-4 text-sm text-gray-700">
              <p className="font-semibold">Selected Files:</p>
              <ul className="list-disc list-inside">
                {selectedFileNames.map((name, index) => (
                  <li key={index}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-sm text-gray-600">
            Hold Ctrl (Windows) or Command (Mac) and click to select multiple
            files. Data will not be saved.
          </p>
        </div>

        {extractedData.length > 0 && (
          <div className="mb-8 p-4 border border-gray-300 rounded-lg bg-gray-50">
            <label
              htmlFor="field-selection"
              className="block text-lg font-medium text-gray-700 mb-3"
            >
              Select Fields to Display:
            </label>
            <select
              id="field-selection"
              multiple
              size={Math.min(allFields.length, 10)} // Show up to 10 options at once
              onChange={handleFieldSelectionChange}
              value={selectedFields} // This links the select value to the state
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {allFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-600">
              Hold Ctrl (Windows) or Command (Mac) to select multiple fields.
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center text-blue-600 font-semibold text-lg py-4">
            Processing files...
          </div>
        )}

        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6"
            role="alert"
          >
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {extractedData.length > 0 && (
          <>
            <div className="mb-4 flex justify-end space-x-2">
              <button
                onClick={exportToExcel}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Export to Excel
              </button>
            </div>
            <div className="overflow-x-auto relative shadow-md rounded-lg">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-200">
                  <tr>
                    {/* First column header is "Field" */}
                    <th
                      scope="col"
                      className="py-3 px-6 sticky left-0 bg-gray-200 z-10 border-r border-gray-300"
                    >
                      Field
                    </th>
                    {/* Subsequent column headers are the file names */}
                    {extractedData.map((data, index) => (
                      <th
                        key={index}
                        scope="col"
                        className="py-3 px-6 border-l border-gray-300"
                      >
                        {data.fileName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Each row represents a selected field */}
                  {selectedFields.map((field, rowIndex) => (
                    <tr
                      key={field}
                      className="bg-white border-b hover:bg-gray-50"
                    >
                      {/* First cell in each row is the field name */}
                      <th
                        scope="row"
                        className="py-4 px-6 font-medium text-gray-900 whitespace-nowrap sticky left-0 bg-white border-r border-gray-200 z-0"
                      >
                        {field}
                      </th>
                      {/* Subsequent cells contain the data for that field from each file */}
                      {extractedData.map((data, colIndex) => (
                        <td
                          key={colIndex}
                          className="py-4 px-6 border-l border-gray-200"
                        >
                          <div
                            dangerouslySetInnerHTML={{
                              __html: data.fields[field] || "",
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {extractedData.length === 0 && !loading && !error && (
          <p className="text-center text-gray-600 mt-8">
            Upload JSON files to see the extracted data here. Data will not be
            saved.
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
