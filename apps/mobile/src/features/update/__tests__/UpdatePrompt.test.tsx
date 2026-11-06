import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import type { ReactNode } from "react";
import { getLatestRelease } from "../../../api/media";
import { getConsent } from "../../../storage/consent";
import { getPreferences, setDismissedUpdate } from "../../../storage/preferences";
import { UpdatePrompt } from "../UpdatePrompt";

jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "1.4.0" } } }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("../../../api/media", () => ({ getLatestRelease: jest.fn() }));
jest.mock("../../../storage/consent", () => ({ getConsent: jest.fn() }));
jest.mock("../../../storage/preferences", () => ({ getPreferences: jest.fn(), setDismissedUpdate: jest.fn() }));
jest.mock("../../../providers/LocaleProvider", () => ({ useLocale: () => ({ t: (key: string) => key === "updateBody" ? "{version} over {installed}" : key }) }));

const release = { version: "1.5.0", url: "https://github.com/kacigaya/binje/releases/tag/v1.5.0", android: null, androidTv: null, ios: null };

function renderPrompt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<UpdatePrompt />, { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getConsent).mockResolvedValue("accepted");
  jest.mocked(getPreferences).mockResolvedValue({});
  jest.mocked(getLatestRelease).mockResolvedValue(release);
  jest.mocked(setDismissedUpdate).mockResolvedValue();
});

test("offers a newer release and remembers Later", async () => {
  const view = renderPrompt();
  expect(await view.findByText("1.5.0 over 1.4.0")).toBeTruthy();
  fireEvent.press(view.getByText("later"));
  expect(setDismissedUpdate).toHaveBeenCalledWith("1.5.0");
  expect(view.queryByText("updateTitle")).toBeNull();
});

test("opens the download and shows the address when it cannot", async () => {
  jest.mocked(Linking.openURL).mockRejectedValue(new Error("no browser"));
  const view = renderPrompt();
  fireEvent.press(await view.findByText("update"));
  expect(Linking.openURL).toHaveBeenCalledWith(release.url);
  expect(await view.findByText(new RegExp(release.url.replace(/[.?]/g, "\\$&")))).toBeTruthy();
});

test("stays hidden for a dismissed version and waits for consent", async () => {
  jest.mocked(getPreferences).mockResolvedValue({ dismissedUpdate: "1.5.0" });
  const dismissed = renderPrompt();
  await waitFor(() => expect(getLatestRelease).toHaveBeenCalled());
  expect(dismissed.queryByText("updateTitle")).toBeNull();
  dismissed.unmount();

  jest.clearAllMocks();
  jest.mocked(getConsent).mockResolvedValue(null);
  jest.mocked(getPreferences).mockResolvedValue({});
  renderPrompt();
  await waitFor(() => expect(getConsent).toHaveBeenCalled());
  expect(getLatestRelease).not.toHaveBeenCalled();
});
