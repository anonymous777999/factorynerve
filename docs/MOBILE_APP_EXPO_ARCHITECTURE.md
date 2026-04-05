# Mobile App Architecture For DPR.ai

This guide is tailored to the current DPR.ai product, not a generic template.

Current product areas already visible in the web app:
- Auth and session context
- Dashboard and alerts
- Attendance and attendance review
- OCR documents and verification
- Reports and exports
- Steel operations: charts, dispatches, invoices, reconciliations, customers
- Premium/owner intelligence

Existing backend API domains already map cleanly to mobile service modules:
- `auth`
- `dashboard`
- `attendance`
- `ocr`
- `reports`
- `analytics`
- `alerts`
- `steel`
- `premium`
- `settings`

The mobile app should rebuild the product as a native experience, not mirror every web screen one-to-one.

## Step 1: Architecture

### Recommended stack

- Expo + React Native + TypeScript
- Expo Router for navigation
- Zustand for global app state
- TanStack Query for server state and caching
- Axios for API transport
- React Hook Form + Zod for forms
- Expo Secure Store for token persistence
- React Native Gifted Charts or Victory Native XL for charts
- Expo Image Picker + Expo Camera + Expo Document Picker for documents

### Why this stack

- Expo keeps mobile builds, camera, permissions, notifications, and updates fast.
- Expo Router gives file-based navigation and scales cleanly for many modules.
- Zustand is better than Context-only for auth/session/app UI state.
- TanStack Query is the right tool for dashboard/report/attendance server data.
- Axios gives interceptors, auth retry, and typed domain clients.

### Folder structure

```text
mobile/
  app/
    _layout.tsx
    (auth)/
      _layout.tsx
      login.tsx
      forgot-password.tsx
    (tabs)/
      _layout.tsx
      dashboard.tsx
      attendance.tsx
      dispatch.tsx
      documents.tsx
      reports.tsx
      notifications.tsx
    modal/
      filter-sheet.tsx
      upload-options.tsx
    steel/
      charts.tsx
      reconciliations.tsx
      dispatch-detail/[id].tsx
    attendance/
      live.tsx
      review.tsx
    documents/
      verify/[id].tsx
    profile/
      index.tsx
    settings/
      index.tsx

  src/
    components/
      common/
        AppHeader.tsx
        Screen.tsx
        EmptyState.tsx
        ErrorState.tsx
        LoadingBlock.tsx
        StatCard.tsx
        SegmentedTabs.tsx
      forms/
        TextField.tsx
        PasswordField.tsx
        DateField.tsx
        SelectField.tsx
      dashboard/
        DashboardSummaryCards.tsx
        AlertList.tsx
        ProductionChart.tsx
      attendance/
        PunchCard.tsx
        AttendanceSummary.tsx
        AttendanceRow.tsx
      dispatch/
        DispatchCard.tsx
        DispatchChecklist.tsx
      documents/
        CapturePicker.tsx
        OcrPreviewTable.tsx
        ConfidenceBadge.tsx
      reports/
        ReportFilters.tsx
        ReportMetricCards.tsx
      steel/
        StockTrustCard.tsx
        RiskCard.tsx
        ChartActionLane.tsx

    navigation/
      guards.ts
      role-routes.ts
      tab-config.ts

    services/
      api/
        client.ts
        interceptors.ts
        auth.service.ts
        dashboard.service.ts
        attendance.service.ts
        documents.service.ts
        reports.service.ts
        steel.service.ts
        notifications.service.ts
      storage/
        secure-store.ts
        async-store.ts

    hooks/
      useAuth.ts
      useSessionBootstrap.ts
      useDashboard.ts
      useAttendance.ts
      useDispatches.ts
      useOcrJobs.ts
      useRoleNavigation.ts
      useOfflineQueue.ts

    store/
      auth.store.ts
      app.store.ts
      filters.store.ts
      offline.store.ts

    query/
      query-client.ts
      query-keys.ts

    utils/
      env.ts
      format.ts
      permissions.ts
      file.ts
      validation.ts
      constants.ts

    types/
      auth.ts
      dashboard.ts
      attendance.ts
      documents.ts
      reports.ts
      steel.ts
      api.ts

    theme/
      colors.ts
      spacing.ts
      typography.ts
      index.ts
```

### Why each part exists

- `app/`: navigation entry points and screen routing
- `components/`: reusable native UI, not screen-specific logic
- `navigation/`: role-based tab visibility and route rules
- `services/api/`: all backend communication in one place
- `hooks/`: screen orchestration and reusable data logic
- `store/`: auth state, UI state, offline queue state
- `query/`: server caching, invalidation, background refresh
- `utils/`: formatting, permissions, validation, helper logic
- `types/`: shared domain models aligned with backend payloads
- `theme/`: consistent colors, typography, spacing

## Step 2: Core Setup

### Create Expo app

```bash
npx create-expo-app@latest dpr-mobile -t expo-template-blank-typescript
cd dpr-mobile
```

### Install dependencies

```bash
npx expo install expo-router expo-secure-store expo-constants expo-linking expo-status-bar
npx expo install expo-camera expo-image-picker expo-document-picker expo-file-system
npx expo install expo-notifications expo-network expo-device
npx expo install react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated

npm install axios zustand @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
npm install gifted-charts react-native-svg
```

### Enable Expo Router

In `package.json`:

```json
{
  "main": "expo-router/entry"
}
```

### Start project

```bash
npx expo start
```

## Step 3: Navigation Setup

### Root layout

`app/_layout.tsx`

```tsx
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "../src/query/query-client";
import { useSessionBootstrap } from "../src/hooks/useSessionBootstrap";

export default function RootLayout() {
  useSessionBootstrap();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="documents/verify/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="modal/filter-sheet" options={{ presentation: "modal" }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### Bottom tabs

`app/(tabs)/_layout.tsx`

```tsx
import { Tabs } from "expo-router";
import { useMemo } from "react";

import { useAuthStore } from "../../src/store/auth.store";
import { getRoleTabs } from "../../src/navigation/tab-config";

export default function TabsLayout() {
  const role = useAuthStore((state) => state.user?.role);
  const tabs = useMemo(() => getRoleTabs(role), [role]);

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarLabel: tab.title,
          }}
        />
      ))}
    </Tabs>
  );
}
```

### Role-based tabs

Use the same product logic already present in the web app:

- Operator: `Dashboard`, `Attendance`, `Documents`, `Dispatch`
- Supervisor: `Dashboard`, `Attendance`, `Documents`, `Reports`, `Notifications`
- Accountant: `Dashboard`, `Reports`, `Dispatch`, `Notifications`
- Manager: `Dashboard`, `Dispatch`, `Reports`, `Notifications`
- Owner: `Dashboard`, `Reports`, `Notifications`

Do not expose every desktop route in bottom tabs.

## Step 4: State Management

### Best choice

Use:
- `Zustand` for client state
- `TanStack Query` for API state

### Why

Context API only:
- okay for tiny apps
- weak for this level of auth, roles, notifications, filters, offline queue

Redux:
- powerful
- too heavy for your current startup speed unless many teams are editing the mobile app at once

Zustand:
- simpler
- scalable enough
- clean for auth/session/preferences/offline state

### Global auth store

`src/store/auth.store.ts`

```ts
import { create } from "zustand";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type Factory = {
  factory_id: string;
  name: string;
  industry_type?: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  activeFactory: Factory | null;
  isAuthenticated: boolean;
  setSession: (payload: { token: string; user: User; activeFactory?: Factory | null }) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  activeFactory: null,
  isAuthenticated: false,
  setSession: ({ token, user, activeFactory = null }) =>
    set({
      token,
      user,
      activeFactory,
      isAuthenticated: true,
    }),
  clearSession: () =>
    set({
      token: null,
      user: null,
      activeFactory: null,
      isAuthenticated: false,
    }),
}));
```

## Step 5: API Integration

### Axios client

`src/services/api/client.ts`

```ts
import axios from "axios";
import Constants from "expo-constants";

import { getSecureToken } from "../storage/secure-store";

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await getSecureToken("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error.message ||
      "Something went wrong";

    return Promise.reject(new Error(message));
  },
);
```

### Auth service

`src/services/api/auth.service.ts`

```ts
import { api } from "./client";

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post("/auth/login", payload);
  return data;
}

export async function getAuthContext() {
  const { data } = await api.get("/auth/context");
  return data;
}
```

### Dashboard service

`src/services/api/dashboard.service.ts`

```ts
import { api } from "./client";

export async function getWeeklyAnalytics() {
  const { data } = await api.get("/analytics/weekly");
  return data;
}

export async function getUnreadAlerts() {
  const { data } = await api.get("/alerts");
  return data;
}

export async function getUsage() {
  const { data } = await api.get("/settings/usage");
  return data;
}
```

### Query hook example

`src/hooks/useDashboard.ts`

```ts
import { useQuery } from "@tanstack/react-query";

import { getUnreadAlerts, getUsage, getWeeklyAnalytics } from "../services/api/dashboard.service";

export function useDashboard() {
  const analytics = useQuery({
    queryKey: ["dashboard", "analytics", "weekly"],
    queryFn: getWeeklyAnalytics,
  });

  const alerts = useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: getUnreadAlerts,
  });

  const usage = useQuery({
    queryKey: ["dashboard", "usage"],
    queryFn: getUsage,
  });

  return { analytics, alerts, usage };
}
```

### Loading and error handling

- use skeletons for dashboard cards and lists
- use pull-to-refresh for overview screens
- use inline error card, not only toast
- for failed mutations, show short error + retry CTA

## Step 6: Screen Design

### 1. Login Screen

#### Layout

- logo/title at top
- email/password form in middle
- primary CTA
- forgot password link
- do not over-design

#### Sample code

```tsx
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { View, Text, TextInput, Pressable } from "react-native";

import { login } from "../../src/services/api/auth.service";
import { saveSecureToken } from "../../src/services/storage/secure-store";
import { useAuthStore } from "../../src/store/auth.store";

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const { control, handleSubmit } = useForm<{ email: string; password: string }>();

  const onSubmit = async (values: { email: string; password: string }) => {
    const result = await login(values);
    await saveSecureToken("access_token", result.access_token);
    setSession({
      token: result.access_token,
      user: result.user,
      activeFactory: result.active_factory,
    });
    router.replace("/(tabs)/dashboard");
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>DPR.ai Mobile</Text>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput placeholder="Email" value={value} onChangeText={onChange} style={{ borderWidth: 1, padding: 14, borderRadius: 12 }} />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput placeholder="Password" secureTextEntry value={value} onChangeText={onChange} style={{ borderWidth: 1, padding: 14, borderRadius: 12 }} />
        )}
      />
      <Pressable onPress={handleSubmit(onSubmit)} style={{ backgroundColor: "#0f766e", padding: 16, borderRadius: 12 }}>
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600" }}>Sign In</Text>
      </Pressable>
    </View>
  );
}
```

### 2. Dashboard Screen

#### Layout

- top summary cards
- alert strip
- chart section
- quick actions
- pull to refresh

#### Sample code

```tsx
import { ScrollView, Text, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";

import { useDashboard } from "../../src/hooks/useDashboard";

export default function DashboardScreen() {
  const { analytics, alerts, usage } = useDashboard();

  const chartData =
    analytics.data?.map((item: any) => ({
      value: item.units,
      label: item.date.slice(5),
    })) || [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Dashboard</Text>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 16 }}>
          <Text>Alerts</Text>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{alerts.data?.length || 0}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 16 }}>
          <Text>Requests Used</Text>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{usage.data?.requests_used || 0}</Text>
        </View>
      </View>

      <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Weekly Output</Text>
        <BarChart data={chartData} barWidth={22} spacing={18} />
      </View>
    </ScrollView>
  );
}
```

### 3. Attendance Screen

#### Layout

- punch card at top
- today's status
- shift summary
- optional team/live tab for supervisor

#### Sample code

```tsx
import { ScrollView, Text, View, Pressable } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";

import { getMyAttendanceToday, punchAttendance } from "../../src/services/api/attendance.service";

export default function AttendanceScreen() {
  const today = useQuery({ queryKey: ["attendance", "today"], queryFn: getMyAttendanceToday });
  const punch = useMutation({
    mutationFn: punchAttendance,
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Attendance</Text>
      <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16, gap: 8 }}>
        <Text>Status: {today.data?.status || "-"}</Text>
        <Text>Shift: {today.data?.shift || "-"}</Text>
        <Pressable
          onPress={() => punch.mutate({ action: today.data?.can_punch_out ? "out" : "in" })}
          style={{ backgroundColor: "#0f766e", padding: 14, borderRadius: 12 }}
        >
          <Text style={{ color: "#fff", textAlign: "center" }}>
            {today.data?.can_punch_out ? "Punch Out" : "Punch In"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

### 4. Dispatch Screen

#### Layout

- active dispatch cards
- status chips
- one tap into detail
- mobile-first checklist before submit

#### Sample code

```tsx
import { FlatList, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { listSteelDispatches } from "../../src/services/api/steel.service";

export default function DispatchScreen() {
  const dispatches = useQuery({
    queryKey: ["steel", "dispatches"],
    queryFn: () => listSteelDispatches(20),
  });

  return (
    <FlatList
      data={dispatches.data?.items || []}
      keyExtractor={(item: any) => String(item.id)}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16 }}>
          <Text style={{ fontWeight: "700" }}>{item.dispatch_code || `Dispatch #${item.id}`}</Text>
          <Text>Status: {item.status}</Text>
          <Text>Vehicle: {item.vehicle_number || "-"}</Text>
        </View>
      )}
    />
  );
}
```

### 5. Documents Upload Screen

#### Layout

- camera / gallery / file picker buttons
- preview thumbnail
- upload button
- OCR status or progress

#### Sample code

```tsx
import { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

export default function DocumentsScreen() {
  const [uri, setUri] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] });
    if (!result.canceled) setUri(result.assets[0].uri);
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({});
    if (!result.canceled) setUri(result.assets[0].uri);
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Documents</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable onPress={pickImage} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#fff" }}>
          <Text>Open Gallery</Text>
        </Pressable>
        <Pressable onPress={pickFile} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#fff" }}>
          <Text>Pick File</Text>
        </Pressable>
      </View>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: 240, borderRadius: 16 }} /> : null}
    </View>
  );
}
```

### 6. Reports Screen

#### Layout

- date filters
- summary cards
- chart
- export CTA

#### Sample code

```tsx
import { ScrollView, Text, View, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { getReportInsights } from "../../src/services/api/reports.service";

export default function ReportsScreen() {
  const report = useQuery({
    queryKey: ["reports", "insights", "week"],
    queryFn: () =>
      getReportInsights({
        startDate: "2026-04-01",
        endDate: "2026-04-07",
      }),
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Reports</Text>
      <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16 }}>
        <Text>Total Units</Text>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>{report.data?.totals.total_units_produced || 0}</Text>
      </View>
      <Pressable style={{ backgroundColor: "#0f766e", padding: 14, borderRadius: 12 }}>
        <Text style={{ color: "#fff", textAlign: "center" }}>Export Report</Text>
      </Pressable>
    </ScrollView>
  );
}
```

## Step 7: Mobile UX Improvements

### Principles

- mobile != desktop shrunk
- one primary action per screen
- bottom sheets for filters and secondary actions
- cards first, tables second
- keep chart labels short
- use role-based tabs, not full desktop navigation

### Improvements over current web UX

- dispatch checklist becomes a step flow
- reports use saved presets and compact cards
- OCR review becomes flagged-cells-first, not a giant table first
- owner dashboard becomes summary-first, drill-down second
- supervisor sees queue and action lanes, not every management widget

## Step 8: Production Readiness

### Environment variables

Use `app.config.ts`:

```ts
export default {
  expo: {
    name: "DPR.ai",
    slug: "dpr-ai-mobile",
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    },
  },
};
```

### Secure token storage

Use `expo-secure-store` for:
- access token
- refresh token if needed

Do not store tokens in AsyncStorage.

### Build APK / IPA

```bash
npx expo install eas-cli
npx eas build:configure
npx eas build -p android --profile preview
npx eas build -p ios --profile production
```

### Performance

- TanStack Query caching for dashboard/report data
- lazy-load non-primary screens
- paginate dispatch and report lists
- compress upload images before OCR upload
- use FlatList for long lists
- keep charts below the fold when possible

## Step 9: Bonus Features That Increase Value

### High-value mobile additions

- push notifications for approvals, dispatch updates, and risk alerts
- offline attendance queue
- offline draft capture for documents
- barcode or QR scan for dispatch/batch lookup
- camera-first OCR upload flow
- role-based home screen
- owner notifications for anomaly spikes

### Best mobile product wedge

Start mobile with:
- Login
- Dashboard
- Attendance
- Documents upload
- Dispatch
- Reports
- Notifications

Do not start with every admin/settings screen.

## Step 10: Recommended Rollout

### Phase 1

- Auth
- Dashboard
- Attendance
- Notifications

### Phase 2

- Documents upload
- OCR job status
- Report summaries

### Phase 3

- Dispatch
- Steel charts mobile view
- owner alerts

### Phase 4

- offline mode
- attendance review
- OCR verification

## Final Recommendation

For DPR.ai mobile, the best architecture is:
- Expo Router
- Zustand
- TanStack Query
- Axios service modules by domain
- Native screen rebuilds, not route mirroring

The mobile app should be:
- role-based
- action-first
- offline-aware
- camera-first for documents
- chart-light but insight-heavy

That gives you a real production app, not a web clone.
