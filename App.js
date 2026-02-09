import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import {
  Provider as PaperProvider,
  DefaultTheme,
  DarkTheme,
  Appbar,
  IconButton,
  Snackbar,
  useTheme,
  Switch,
} from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HERO = require("./assets/welcomepage.jpg");
const H = Dimensions.get("window").height;

/* ---------- theme ---------- */
const Light = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#E91E63", // pink header
    secondary: "#F7A400",
  },
};
const Dark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#BB86FC", // distinct from light so the change is obvious
    secondary: "#FFC86A",
  },
};

const TABS = [
  { key: "HOME", label: "Home", icon: "search" },
  { key: "FAVS", label: "Favourites", icon: "favorite-border" },
  { key: "PLAN", label: "Planner", icon: "event-note" },
  { key: "SETTINGS", label: "Settings", icon: "settings" },
];

/* ---------- tiny router (with history) ---------- */
function useRouter() {
  const [stack, setStack] = useState([{ name: "WELCOME", params: null }]);
  const route = stack[stack.length - 1];

  const navigate = (name, params = null) =>
    setStack((s) => [...s, { name, params }]);

  const replace = (name, params = null) =>
    setStack((s) => [...s.slice(0, -1), { name, params }]);

  const goBack = () =>
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  return [route, navigate, goBack, replace];
}

/* ---------- TheMealDB helpers ---------- */
async function searchMeals(q) {
  const url =
    "https://www.themealdb.com/api/json/v1/1/search.php?s=" +
    encodeURIComponent(q || "");
  const r = await fetch(url);
  const js = await r.json();
  return js.meals || [];
}
async function lookupMeal(id) {
  const url = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=" + id;
  const r = await fetch(url);
  const js = await r.json();
  return js.meals?.[0] || null;
}
async function randomMeal() {
  const r = await fetch("https://www.themealdb.com/api/json/v1/1/random.php");
  const js = await r.json();
  return js.meals?.[0] || null;
}
async function listCategories() {
  const r = await fetch("https://www.themealdb.com/api/json/v1/1/list.php?c=list");
  const js = await r.json();
  return (js.meals || []).map((x) => x.strCategory);
}
async function listAreas() {
  const r = await fetch("https://www.themealdb.com/api/json/v1/1/list.php?a=list");
  const js = await r.json();
  return (js.meals || []).map((x) => x.strArea);
}

function extractIngredients(meal) {
  const items = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const meas = meal[`strMeasure${i}`];
    if (ing && ing.trim()) {
      items.push({ name: ing.trim(), amount: (meas || "").trim() });
    }
  }
  return items;
}

/* ---------- Planner utils ---------- */
const DAYS_BASE = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function getDays(weekStart = "Mon") {
  return weekStart === "Sun"
    ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    : DAYS_BASE;
}

function makeEmptyPlanFrom(days, slots) {
  const p = {};
  days.forEach(d => {
    p[d] = {};
    slots.forEach(m => { p[d][m] = null; });
  });
  return p;
}


const FavCtx = React.createContext(null);

/* ---------- persistence: AsyncStorage (native) + localStorage (web) ---------- */
function usePersistentState(key, initialValue) {
  const [state, setState] = React.useState(initialValue);

  // load
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (Platform.OS === "web") {
          const raw = window?.localStorage?.getItem(key);
          if (raw != null && alive) setState(JSON.parse(raw));
        } else {
          const raw = await AsyncStorage.getItem(key);
          if (raw != null && alive) setState(JSON.parse(raw));
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [key]);

  // save
  React.useEffect(() => {
    (async () => {
      try {
        const payload = JSON.stringify(state);
        if (Platform.OS === "web") {
          window?.localStorage?.setItem(key, payload);
        } else {
          await AsyncStorage.setItem(key, payload);
        }
      } catch {}
    })();
  }, [key, state]);

  return [state, setState];
}

/* ---------- basic screen ---------- */
const Screen = ({ title, children }) => {
  const theme = useTheme();
  const textColor = theme.colors?.onSurface ?? theme.colors.text;
  const borderCol = theme.dark ? "rgba(255,255,255,0.15)" : "#eee";
  return (
    <View style={[styles.loginScreen, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.h1, { color: textColor }]}>{title}</Text>
      <View style={{ marginTop: 12 }}>
        {children}
      </View>
    </View>
  );
};

/* ---------- Welcome ---------- */
function Welcome({ onContinue, onLogin, onSignup }) {
  const theme = useTheme();
  const textColor = theme.colors?.onSurface ?? theme.colors.text;
  const surface = theme.colors.surface;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Image source={HERO} style={styles.hero} resizeMode="cover" />
      <View style={[styles.welcomeBox, { backgroundColor: surface }]}>
        <Text style={[styles.brand, { color: textColor }]}>QuickBites</Text>
        <Text style={[styles.tagline, { color: textColor, opacity: 0.8 }]}>
          Delicious meals right at your fingertips!
        </Text>

        <View style={styles.authRow}>
          <TouchableOpacity
            style={[styles.authBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onLogin}
          >
            <Text style={styles.authBtnText}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onSignup}
          >
            <Text style={styles.authBtnText}>Sign up</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onContinue} style={styles.guestLink}>
          <Text style={[styles.guestText, { color: textColor }]}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------- Login ---------- */
function Login({ onBack, onSuccess }) {
  const theme = useTheme();
  const textColor = theme.colors?.onSurface ?? theme.colors.text;
  const borderCol = theme.dark ? "rgba(255,255,255,0.15)" : "#ccc";

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = email.includes("@") && pw.length >= 6;

  function submit() {
    if (!canSubmit) {
      setErr("Enter a valid email and a password with 6+ characters.");
      return;
    }
    setErr("");
    onSuccess();
  }

  return (
    <View style={[styles.loginScreen, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.h1, { textAlign: "center", color: textColor }]}>Log in</Text>
      <Text style={[styles.p, { textAlign: "center", marginBottom: 12, color: textColor, opacity: 0.8 }]}>
        Use your QuickBites account to sync favourites & planner.
      </Text>

      <Text style={[styles.label, { color: textColor }]}>Email</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: borderCol, color: textColor }]}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={theme.dark ? "rgba(255,255,255,0.6)" : "#777"}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, { color: textColor }]}>Password</Text>
      <View style={{ position: "relative" }}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: borderCol, color: textColor }]}
          value={pw}
          onChangeText={setPw}
          placeholder="••••••••"
          placeholderTextColor={theme.dark ? "rgba(255,255,255,0.6)" : "#777"}
          secureTextEntry={!showPw}
          autoCapitalize="none"
        />
        <TouchableOpacity
          onPress={() => setShowPw((s) => !s)}
          style={styles.eyeBtn}
          accessibilityLabel={showPw ? "Hide password" : "Show password"}
        >
          <Text style={{ fontWeight: "700", color: textColor }}>{showPw ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>

      {!!err && <Text style={[styles.error, { color: "#C62828" }]}>{err}</Text>}

      <TouchableOpacity
        style={[styles.formBtn, !canSubmit && { opacity: 0.5 }, { backgroundColor: theme.colors.primary }]}
        onPress={submit}
        disabled={!canSubmit}
      >
        <Text style={styles.formBtnText}>Log in</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={{ marginTop: 10 }}>
        <Text style={[styles.linkSmall, { color: "#4452C7" }]}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- Signup ---------- */
function Signup({ onBack, onSuccess }) {
  const theme = useTheme();
  const textColor = theme.colors?.onSurface ?? theme.colors.text;
  const borderCol = theme.dark ? "rgba(255,255,255,0.15)" : "#ccc";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");

  const strongPw = pw.length >= 6;
  const canSubmit =
    name.trim().length >= 2 && email.includes("@") && strongPw && pw2 === pw;

  function submit() {
    if (!canSubmit) {
      setErr(
        pw2 !== pw
          ? "Passwords do not match."
          : "Enter a name, valid email, and password with 6+ characters."
      );
      return;
    }
    setErr("");
    onSuccess();
  }

  return (
    <View style={[styles.loginScreen, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.h1, { textAlign: "center", color: textColor }]}>Sign up</Text>
      <Text style={[styles.p, { textAlign: "center", marginBottom: 12, color: textColor, opacity: 0.8 }]}>
        Create your QuickBites account to save favourites & plan meals.
      </Text>

      <Text style={[styles.label, { color: textColor }]}>Name</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: borderCol, color: textColor }]}
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={theme.dark ? "rgba(255,255,255,0.6)" : "#777"}
      />

      <Text style={[styles.label, { color: textColor }]}>Email</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: borderCol, color: textColor }]}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={theme.dark ? "rgba(255,255,255,0.6)" : "#777"}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, { color: textColor }]}>Password</Text>
      <View style={{ position: "relative" }}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: borderCol, color: textColor }]}
          value={pw}
          onChangeText={setPw}
          placeholder="••••••••"
          placeholderTextColor={theme.dark ? "rgba(255,255,255,0.6)" : "#777"}
          secureTextEntry={!showPw}
          autoCapitalize="none"
        />
        <TouchableOpacity
          onPress={() => setShowPw((s) => !s)}
          style={styles.eyeBtn}
          accessibilityLabel={showPw ? "Hide password" : "Show password"}
        >
          <Text style={{ fontWeight: "700", color: textColor }}>{showPw ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: textColor }]}>Confirm Password</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: borderCol, color: textColor }]}
        value={pw2}
        onChangeText={setPw2}
        placeholder="••••••••"
        placeholderTextColor={theme.dark ? "rgba(255,255,255,0.6)" : "#777"}
        secureTextEntry={!showPw}
        autoCapitalize="none"
      />

      {!!err && <Text style={[styles.error, { color: "#C62828" }]}>{err}</Text>}

      <TouchableOpacity
        style={[styles.formBtn, !canSubmit && { opacity: 0.5 }, { backgroundColor: theme.colors.primary }]}
        onPress={submit}
        disabled={!canSubmit}
      >
        <Text style={styles.formBtnText}>Create account</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={{ marginTop: 10 }}>
        <Text style={[styles.linkSmall, { color: "#4452C7" }]}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- Home (with modal filters) ---------- */
function Home({ onOpen, onPlan }) {
  const theme = useTheme();
  const textColor = theme.colors?.onSurface ?? theme.colors.text;
  const surface = theme.colors.surface;
  const borderCol = theme.dark ? "rgba(255,255,255,0.15)" : "#eee";
  const chipBorder = theme.dark ? "rgba(255,255,255,0.2)" : "#e3e3e3";
  const dimText = theme.dark ? "rgba(255,255,255,0.7)" : "#333";

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  // modal filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [allCats, setAllCats] = useState([]);
  const [allAreas, setAllAreas] = useState([]);
  const [selCats, setSelCats] = useState([]); // multi
  const [selAreas, setSelAreas] = useState([]); // multi

  // layout + featured + recent
  const [showGrid, setShowGrid] = useState(false);
  const [featured, setFeatured] = useState(null);
  const [recent, setRecent] = useState([]);
  const fav = React.useContext(FavCtx);

  // vegetarian-only pref
  const [vegOnly] = usePersistentState("qb:pref:vegOnly", false);

  const listKey = showGrid ? "GRID_2" : "LIST_1";

  async function runSearch(term) {
    setLoading(true);
    setError("");
    try {
      const data = await searchMeals(term);
      setResults(data);
      if (term && term.trim()) {
        setRecent((prev) => {
          const next = [term.trim(), ...prev.filter((x) => x !== term.trim())];
          return next.slice(0, 8);
        });
      }
    } catch (e) {
      setError("Could not fetch recipes. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    runSearch("chicken");
    (async () => {
      try {
        const [cs, as] = await Promise.all([listCategories(), listAreas()]);
        setAllCats(cs);
        setAllAreas(as);
      } catch {}
    })();
    (async () => {
      try {
        const f = await randomMeal();
        setFeatured(f ?? null);
      } catch {
        setFeatured(null);
      }
    })();
  }, []);

  // apply modal filters + vegOnly
  const filtered = results.filter((r) => {
    if (vegOnly && r.strCategory !== "Vegetarian") return false;
    if (selCats.length && !selCats.includes(r.strCategory)) return false;
    if (selAreas.length && !selAreas.includes(r.strArea)) return false;
    return true;
  });

  const renderItem = ({ item }) => {
    const isGrid = showGrid;
    const cardStyle = isGrid ? styles.cardGrid : styles.card;
    const thumbStyle = isGrid ? styles.cardThumbGrid : styles.cardThumb;
    const saved = fav.isFav(item.idMeal);

    return (
      <TouchableOpacity
        style={[
          cardStyle,
          { backgroundColor: surface, borderColor: borderCol }
        ]}
        onPress={() => onOpen(item.idMeal)}
        activeOpacity={0.85}
      >
        {/* image + favourite heart + plan */}
        <View style={{ position: "relative", marginRight: isGrid ? 0 : 12 }}>
          <Image source={item?.strMealThumb ? { uri: item.strMealThumb } : HERO} style={thumbStyle} />

          {/* FAV HEART */}
          <TouchableOpacity
            style={[styles.heartBtn, { backgroundColor: surface }]}
            onPress={(e) => { e.stopPropagation?.(); fav.toggleFav(item); }}
            accessibilityLabel={saved ? "Remove from favourites" : "Save to favourites"}
          >
            <MaterialIcons name={saved ? "favorite" : "favorite-border"} size={18} color={theme.colors.primary} />
          </TouchableOpacity>

          {/* PLAN BUTTON (calendar) */}
          <TouchableOpacity
            style={[styles.planBtn, { backgroundColor: surface }]}
            onPress={(e) => { e.stopPropagation?.(); onPlan(item.idMeal); }}
            accessibilityLabel="Plan this meal"
          >
            <MaterialIcons name="event-available" size={18} color="#9C27B0" />
          </TouchableOpacity>
        </View>

        {/* text */}
        {isGrid ? (
          <View>
            <Text numberOfLines={2} style={[styles.gridTitle, { color: textColor }]}>{item.strMeal}</Text>
            <View style={styles.metaRow}>
              {!!item.strCategory && (
                <View style={[styles.metaChipSm, { borderColor: chipBorder }]}>
                  <Text style={[styles.metaTextSm, { color: dimText }]}>{item.strCategory}</Text>
                </View>
              )}
              {!!item.strArea && (
                <View style={[styles.metaChipSm, { borderColor: chipBorder }]}>
                  <Text style={[styles.metaTextSm, { color: dimText }]}>{item.strArea}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: textColor }]}>{item.strMeal}</Text>
            <View style={styles.metaRow}>
              {!!item.strCategory && (
                <View style={[styles.metaChip, { borderColor: chipBorder }]}>
                  <Text style={[styles.metaText, { color: dimText }]}>{item.strCategory}</Text>
                </View>
              )}
              {!!item.strArea && (
                <View style={[styles.metaChip, { borderColor: chipBorder }]}>
                  <Text style={[styles.metaText, { color: dimText }]}>{item.strArea}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View>
      {/* compact header panel */}
      <View style={[styles.headerCard, { backgroundColor: surface, borderColor: borderCol }]}>
        {/* Row 1: input only */}
<View style={styles.searchRow}>
  <TextInput
    value={q}
    onChangeText={setQ}
    placeholder="Search recipes (e.g., pasta, curry)…"
    placeholderTextColor={theme.dark ? "rgba(255,255,255,0.6)" : "#777"}
    style={[
      styles.searchInput,
      {
        flex: 1,
        backgroundColor: surface,
        borderColor: theme.dark ? "rgba(255,255,255,0.15)" : "#ccc",
        color: textColor,
      },
    ]}
    returnKeyType="search"
    onSubmitEditing={() => runSearch(q)}
  />
</View>

  {/* Row 2: icons (left) + Search button (right) */}
<View style={styles.toolbarRow}>
  <View style={{ flexDirection: "row", gap: 8 }}>
    <TouchableOpacity
      style={[styles.iconBtn, { backgroundColor: "#9C27B0" }]}
      onPress={() => setFilterOpen(true)}
      accessibilityLabel="Open filters"
    >
      <MaterialIcons name="tune" size={20} color="white" />
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.iconBtn, { backgroundColor: "#9C27B0" }]}
      onPress={() => setShowGrid((g) => !g)}
      accessibilityLabel={showGrid ? "Switch to list" : "Switch to grid"}
    >
      <MaterialIcons
        name={showGrid ? "view-agenda" : "apps"}
        size={20}
        color="white"
      />
    </TouchableOpacity>
  </View>

  <TouchableOpacity
    style={[styles.searchBtn, { backgroundColor: theme.colors.primary }]}
    onPress={() => runSearch(q)}
  >
     <Text style={[styles.formBtnText, { fontSize: 14 }]}>Search</Text>
</TouchableOpacity>
</View>

        {/* Quick filters */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>Quick filters</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hChipRow}
        >
          {["Chicken", "Pasta", "Vegetarian"].map((w) => (
            <TouchableOpacity
              key={w}
              style={[styles.quickChip, { backgroundColor: theme.dark ? "rgba(233,30,99,0.2)" : "#FFE0ED" }]}
              onPress={() => {
                setQ(w);
                runSearch(w);
              }}
            >
              <Text style={[styles.quickChipText, { color: theme.dark ? "#FFD3E6" : "#B0004F" }]}>{w}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Recent */}
        {recent.length > 0 && (
          <>
            <View style={styles.recentHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Recent</Text>
              <TouchableOpacity onPress={() => setRecent([])}>
                <Text style={[styles.clearLink, { color: "#4452C7" }]}>Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hChipRow}
            >
              {recent.map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.filterChip, { backgroundColor: surface, borderColor: chipBorder }]}
                  onPress={() => {
                    setQ(w);
                    runSearch(w);
                  }}
                >
                  <Text style={[styles.filterChipText, { color: dimText }]}>{w}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      {/* Featured */}
      {featured && (
        <TouchableOpacity
          onPress={() => onOpen(featured.idMeal)}
          style={[styles.featuredCard, { backgroundColor: surface, borderColor: borderCol }]}
          accessibilityLabel={`Open featured recipe ${featured.strMeal}`}
        >
          <Image
            source={featured?.strMealThumb ? { uri: featured.strMealThumb } : HERO}
            style={styles.featuredImg}
          />
          <View style={styles.featuredBody}>
            <Text style={[styles.featuredLabel, { color: "#9C27B0" }]}>Chef’s pick</Text>
            <Text style={[styles.featuredTitle, { color: textColor }]}>{featured.strMeal}</Text>
            <Text style={[styles.featuredMeta, { color: dimText }]}>
              {featured.strCategory}
              {featured.strArea ? ` • ${featured.strArea}` : ""}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* divider */}
      <View style={[styles.sectionDivider, { backgroundColor: theme.dark ? "rgba(255,255,255,0.06)" : "#F7F7F9" }]} />

      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
      {!!error && <Text style={[styles.p, { color: "#C62828", padding: 16 }]}>{error}</Text>}
      {!loading && filtered.length === 0 && !error && (
        <Text style={[styles.p, { padding: 16, opacity: 0.7, color: textColor }]}>
          No recipes found. Try a different keyword or clear filters.
        </Text>
      )}
    </View>
  );

  return (
    <>
      <FlatList
        key={listKey}
        data={filtered}
        keyExtractor={(it) => String(it.idMeal)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: 80, backgroundColor: theme.colors.background }}
        numColumns={showGrid ? 2 : 1}
        columnWrapperStyle={showGrid ? { paddingHorizontal: 16, gap: 12 } : undefined}
      />

      {/* Filter modal */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: surface, borderColor: borderCol }]}>
            <Text style={[styles.h1, { color: textColor }]}>Filters</Text>
            <ScrollView>
              <Text style={[styles.p, { fontWeight: "700", marginTop: 8, color: textColor }]}>Categories</Text>
              <View style={styles.filterRow}>
                {allCats.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.filterChip,
                      { backgroundColor: surface, borderColor: chipBorder },
                      selCats.includes(c) && [styles.filterChipActive, { backgroundColor: theme.dark ? "rgba(233,30,99,0.2)" : "#FFE0ED", borderColor: theme.colors.primary }]
                    ]}
                    onPress={() =>
                      setSelCats((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                      )
                    }
                  >
                    <Text style={[styles.filterChipText, { color: dimText }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.p, { fontWeight: "700", marginTop: 8, color: textColor }]}>Areas</Text>
              <View style={styles.filterRow}>
                {allAreas.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[
                      styles.filterChip,
                      { backgroundColor: surface, borderColor: chipBorder },
                      selAreas.includes(a) && [styles.filterChipActive, { backgroundColor: theme.dark ? "rgba(233,30,99,0.2)" : "#FFE0ED", borderColor: theme.colors.primary }]
                    ]}
                    onPress={() =>
                      setSelAreas((prev) =>
                        prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                      )
                    }
                  >
                    <Text style={[styles.filterChipText, { color: dimText }]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.formBtn, { flex: 1, backgroundColor: theme.dark ? "rgba(255,255,255,0.1)" : "#ddd" }]}
                onPress={() => {
                  setSelCats([]);
                  setSelAreas([]);
                }}
              >
                <Text style={[styles.formBtnText, { color: textColor }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, { flex: 1, backgroundColor: theme.colors.primary }]}
                onPress={() => setFilterOpen(false)}
              >
                <Text style={styles.formBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setFilterOpen(false)}
              style={{ alignSelf: "center", marginTop: 8 }}
            >
              <Text style={[styles.linkSmall, { color: "#4452C7" }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ---------- Details (with shopping list modal) ---------- */
function Details({ id, onOpenDetails }) {
  const theme = useTheme();
  const textColor = theme.colors?.onSurface ?? theme.colors.text;
  const surface = theme.colors.surface;
  const borderCol = theme.dark ? "rgba(255,255,255,0.15)" : "#eee";
  const chipBorder = theme.dark ? "rgba(255,255,255,0.2)" : "#e3e3e3";
  const dimText = theme.dark ? "rgba(255,255,255,0.7)" : "#333";

  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(true);

  // FAVOURITES ctx
  const fav = React.useContext(FavCtx);

  // Shopping list modal state
  const [listOpen, setListOpen] = useState(false);
  const [selected, setSelected] = useState({}); // { "name|amount": boolean }

  React.useEffect(() => {
    (async () => {
      try {
        const m = await lookupMeal(id);
        setMeal(m);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.h1, { color: textColor }]}>Recipe not found</Text>
      </View>
    );
  }

  const saved = fav.isFav(meal.idMeal);
  const ingredients = extractIngredients(meal);
  const steps =
    meal.strInstructions
      ?.split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean) || [];

  function openShoppingList() {
    const sel = {};
    ingredients.forEach((it) => {
      const idKey = `${it.name}|${it.amount || ""}`;
      sel[idKey] = false; // start unchecked
    });
    setSelected(sel);
    setListOpen(true);
  }

  const allSelected = Object.values(selected).length > 0 && Object.values(selected).every(Boolean);
  function toggleOne(idKey) {
    setSelected((prev) => ({ ...prev, [idKey]: !prev[idKey] }));
  }
  function setAll(v) {
    const next = {};
    Object.keys(selected).forEach((k) => (next[k] = v));
    setSelected(next);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Image
        source={meal?.strMealThumb ? { uri: meal.strMealThumb } : HERO}
        style={{ width: "100%", height: 240 }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={[styles.h1, { marginBottom: 4, color: textColor }]}>{meal.strMeal}</Text>
        <Text style={[styles.p, { color: dimText }]}>
          {meal.strCategory} {meal.strArea ? "• " + meal.strArea : ""}
        </Text>

        {/* ONE shopping list button */}
        <TouchableOpacity style={[styles.formBtn, { marginTop: 12, backgroundColor: theme.colors.primary }]} onPress={openShoppingList}>
          <Text style={styles.formBtnText}>Show shopping list</Text>
        </TouchableOpacity>

        {/* Add / Remove favourites */}
        <TouchableOpacity
          style={[styles.formBtn, { marginTop: 10, backgroundColor: saved ? (theme.dark ? "rgba(255,255,255,0.1)" : "#ddd") : theme.colors.primary }]}
          onPress={() => fav.toggleFav(meal)}
          accessibilityLabel={saved ? "Remove from favourites" : "Add to favourites"}
        >
          <Text style={[styles.formBtnText, saved && { color: textColor }]}>
            {saved ? "Remove from favourites" : "Add to favourites"}
          </Text>
        </TouchableOpacity>

        {/* Plan button */}
        <TouchableOpacity
          style={[styles.formBtn, { marginTop: 10, backgroundColor: "#9C27B0" }]}
          onPress={() => onOpenDetails?.(meal.idMeal)}
        >
          <Text style={styles.formBtnText}>Plan this meal</Text>
        </TouchableOpacity>

        {/* Ingredients */}
        <Text style={[styles.sectionTitle, { marginTop: 16, color: textColor }]}>Ingredients</Text>
        {ingredients.map((it, idx) => (
          <View key={idx} style={styles.ingredientRow}>
            <View style={styles.bullet} />
            <Text style={[styles.ingredientText, { color: textColor }]}>
              {it.amount ? `${it.amount} ` : ""}{it.name}
            </Text>
          </View>
        ))}

        {/* Instructions */}
        <Text style={[styles.sectionTitle, { marginTop: 16, color: textColor }]}>Instructions</Text>
        {steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={[styles.stepText, { color: textColor }]}>{s}</Text>
          </View>
        ))}

        {!!meal.strYoutube && (
          <Text style={[styles.p, { marginTop: 16, opacity: 0.8, color: dimText }]}>
            Video: {meal.strYoutube}
          </Text>
        )}
      </ScrollView>

      {/* Shopping list modal */}
      <Modal
        visible={listOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setListOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: surface }]}>
            <Text style={[styles.h1, { color: textColor }]}>Shopping list</Text>
            <Text style={[styles.p, { opacity: 0.7, marginBottom: 8, color: dimText }]}>{meal.strMeal}</Text>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 }}>
              <TouchableOpacity onPress={() => setAll(!allSelected)}>
                <Text style={[styles.linkSmall, { color: "#4452C7" }]}>
                  {allSelected ? "Clear all" : "Select all"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: "60%" }}>
              {ingredients.map((it) => {
                const key = `${it.name}|${it.amount || ""}`;
                const on = !!selected[key];
                return (
                  <View key={key} style={[styles.shopRow, { backgroundColor: surface, borderColor: borderCol }]}>
                    <TouchableOpacity onPress={() => toggleOne(key)} style={styles.shopCheck}>
                      <MaterialIcons
                        name={on ? "check-box" : "check-box-outline-blank"}
                        size={22}
                        color={on ? "#4CAF50" : (theme.dark ? "#bbb" : "#777")}
                      />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.shopName, { color: textColor }]}>{it.name}</Text>
                      {!!it.amount && (
                        <Text style={[styles.p, { opacity: 0.7, color: dimText }]}>{it.amount}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.formBtn, { flex: 1, backgroundColor: theme.dark ? "rgba(255,255,255,0.1)" : "#ddd" }]}
                onPress={() => setListOpen(false)}
              >
                <Text style={[styles.formBtnText, { color: textColor }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Favourites (lists saved recipes) ---------- */
function Favs({ onOpen }) {
  const theme = useTheme();
  const textColor = theme.colors?.onSurface ?? theme.colors.text;
  const surface = theme.colors.surface;
  const borderCol = theme.dark ? "rgba(255,255,255,0.15)" : "#eee";
  const chipBorder = theme.dark ? "rgba(255,255,255,0.2)" : "#e3e3e3";
  const dimText = theme.dark ? "rgba(255,255,255,0.7)" : "#333";

  const fav = React.useContext(FavCtx);
  const data = Object.values(fav.favs);
  const [showGrid, setShowGrid] = useState(true);

  const renderItem = ({ item }) => {
    const isGrid = showGrid;
    return (
      <TouchableOpacity
        style={isGrid ? [styles.favCardGrid, { backgroundColor: surface, borderColor: borderCol }] : [styles.card, { backgroundColor: surface, borderColor: borderCol }]}
        onPress={() => onOpen(item.idMeal)}
        activeOpacity={0.85}
      >
        <Image
          source={item?.strMealThumb ? { uri: item.strMealThumb } : HERO}
          style={isGrid ? styles.favThumbGrid : styles.cardThumb}
        />
        {/* delete pill */}
        <TouchableOpacity
          style={[styles.favDeleteBtn, { backgroundColor: surface, borderColor: borderCol }]}
          onPress={(e) => {
            e.stopPropagation?.();
            fav.removeFav(item.idMeal);
          }}
          accessibilityLabel="Remove from favourites"
        >
          <MaterialIcons name="close" size={16} color={theme.dark ? "#ddd" : "#333"} />
        </TouchableOpacity>

        {/* TEXT */}
        {isGrid ? (
          <View>
            <Text numberOfLines={2} style={[styles.gridTitle, { color: textColor }]}>{item.strMeal}</Text>
            <View style={styles.metaRow}>
              {!!item.strCategory && (
                <View style={[styles.metaChipSm, { borderColor: chipBorder }]}>
                  <Text style={[styles.metaTextSm, { color: dimText }]}>{item.strCategory}</Text>
                </View>
              )}
              {!!item.strArea && (
                <View style={[styles.metaChipSm, { borderColor: chipBorder }]}>
                  <Text style={[styles.metaTextSm, { color: dimText }]}>{item.strArea}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: textColor }]}>{item.strMeal}</Text>
            <View style={styles.metaRow}>
              {!!item.strCategory && (
                <View style={[styles.metaChip, { borderColor: chipBorder }]}>
                  <Text style={[styles.metaText, { color: dimText }]}>{item.strCategory}</Text>
                </View>
              )}
              {!!item.strArea && (
                <View style={[styles.metaChip, { borderColor: chipBorder }]}>
                  <Text style={[styles.metaText, { color: dimText }]}>{item.strArea}</Text>
                </View>
              )}
            </View>
          </View>
        )}

      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* header row */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: textColor }}>
          Saved recipes ({data.length})
        </Text>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#9C27B0" }]} onPress={() => setShowGrid(g => !g)}>
          <MaterialIcons name={showGrid ? "view-agenda" : "apps"} size={20} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        key={showGrid ? "FAV_GRID" : "FAV_LIST"}
        data={data}
        renderItem={renderItem}
        keyExtractor={(it) => String(it.idMeal)}
        numColumns={showGrid ? 2 : 1}
        columnWrapperStyle={
          showGrid ? { justifyContent: "space-between", paddingHorizontal: 16 } : undefined
        }
        contentContainerStyle={{
          paddingBottom: 90,
          paddingHorizontal: showGrid ? 0 : 16,
        }}
      />
    </View>
  );
}

function Planner({ initialMealId = null, onOpenDetails }) {
  const theme = useTheme();
  const textColor = theme.colors?.onSurface ?? theme.colors.text;
  const surface = theme.colors.surface;
  const borderCol = theme.dark ? "rgba(255,255,255,0.15)" : "#eee";
  const chipBorder = theme.dark ? "rgba(255,255,255,0.2)" : "#e3e3e3";
  const dimText = theme.dark ? "rgba(255,255,255,0.7)" : "#333";

  const fav = React.useContext(FavCtx);
    // Read defaults from Settings
  const [weekStart] = usePersistentState("qb:pref:plannerWeekStart", "Mon");
  const [slotsPref] = usePersistentState("qb:pref:plannerSlots", ["Breakfast","Lunch","Dinner"]);

  // Compute days and meal slots from prefs
  const DAYS = React.useMemo(
    () => (weekStart === "Sun"
      ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
      : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]),
    [weekStart]
  );
  const MEALS = slotsPref;

  // Make an empty plan using current prefs
  const makeEmptyPlan = React.useCallback(() => {
    const p = {};
    DAYS.forEach(d => {
      p[d] = {};
      MEALS.forEach(m => { p[d][m] = null; });
    });
    return p;
  }, [DAYS, MEALS]);

  // PLAN state (re-add here so it uses the new makeEmptyPlan)
  const [plan, setPlan] = usePersistentState("qb:plan", makeEmptyPlan());


  // recipe picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickTarget, setPickTarget] = useState({ day: null, meal: null });
  const [tab, setTab] = useState("FAVS");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState([]);

  // slot chooser (for "Plan this meal")
  const [slotOpen, setSlotOpen] = useState(false);
  const [pendingMeal, setPendingMeal] = useState(null);
  const favList = Object.values(fav.favs);

  // NEW prefs
  const [groupShopping] = usePersistentState("qb:pref:groupShopping", true);

  // one-time Snackbar tip
  const [tipSeen, setTipSeen] = usePersistentState("qb:tip:longpress", false);
  const [showTip, setShowTip] = useState(false);
  React.useEffect(() => {
    if (!tipSeen) {
      setShowTip(true);
      setTipSeen(true);
    }
  }, [tipSeen, setTipSeen]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!initialMealId) return;

      // try to reuse the fav summary if it exists
      let summary = fav.favs?.[String(initialMealId)];
      if (!summary) {
        const m = await lookupMeal(initialMealId);
        if (m) {
          summary = {
            idMeal: String(m.idMeal),
            strMeal: m.strMeal,
            strMealThumb: m.strMealThumb,
            strCategory: m.strCategory,
            strArea: m.strArea,
          };
        }
      }

      if (alive && summary) {
        setPendingMeal(summary);
        setSlotOpen(true);
      }
    })();

    return () => { alive = false; };
  }, [initialMealId, fav.favs]);

  async function runSearch(term) {
    setLoading(true);
    try {
      const data = await searchMeals(term);
      setFound(data.map(meal => ({
        idMeal: String(meal.idMeal),
        strMeal: meal.strMeal,
        strMealThumb: meal.strMealThumb,
        strCategory: meal.strCategory,
        strArea: meal.strArea,
      })));
    } catch {
      setFound([]);
    } finally {
      setLoading(false);
    }
  }

  function assign(day, meal, summary) {
    setPlan(prev => ({
      ...prev,
      [day]: { ...prev[day], [meal]: summary }
    }));
    setPickerOpen(false);
    setPickTarget({ day: null, meal: null });
  }

  function openPicker(day, meal) {
    setPickTarget({ day, meal });
    setTab("FAVS");
    setQ("");
    setFound([]);
    setPickerOpen(true);
  }

  function clearSlot(day, meal) {
    setPlan(prev => ({
      ...prev,
      [day]: { ...prev[day], [meal]: null }
    }));
  }

  function clearAll() {
    setPlan(makeEmptyPlan());
  }

  // build combined shopping list (fetch details for UNIQUE meals)
  const [shopOpen, setShopOpen] = useState(false);
  const [shopItems, setShopItems] = useState([]); // array of {name, amount, from}
  const [shopBusy, setShopBusy] = useState(false);

  async function openShoppingList() {
    setShopBusy(true);
    setShopOpen(true);
    try {
      const unique = new Map();
      DAYS.forEach(d => MEALS.forEach(m => {
        const v = plan[d][m];
        if (v) unique.set(v.idMeal, v);
      }));
      const ids = [...unique.keys()];
      const all = [];
      for (const id of ids) {
        const meal = await lookupMeal(id);
        if (!meal) continue;
        const ings = extractIngredients(meal);
        ings.forEach(x => {
          all.push({ name: (x.name || "").trim(), amount: (x.amount || "").trim(), from: meal.strMeal });
        });
      }

      if (!groupShopping) {
        setShopItems(all);
      } else {
        // group by ingredient name (case-insensitive)
        const bucket = new Map(); // key -> { name, amounts:[], froms:Set }
        for (const it of all) {
          const key = it.name.toLowerCase();
          if (!bucket.has(key)) {
            bucket.set(key, { name: it.name, amounts: [], froms: new Set() });
          }
          const obj = bucket.get(key);
          if (it.amount) obj.amounts.push(it.amount);
          if (it.from) obj.froms.add(it.from);
        }
        const grouped = [...bucket.values()].map(x => ({
          name: x.name,
          amount: x.amounts.length ? x.amounts.join(" + ") : "—",
          from: [...x.froms].join(", "),
        }));
        grouped.sort((a, b) => a.name.localeCompare(b.name));
        setShopItems(grouped);
      }
    } catch {
      setShopItems([]);
    } finally {
      setShopBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header actions */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: textColor }}>Planner</Text>
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity style={[styles.iconBtn, { marginRight: 8, backgroundColor: "#9C27B0" }]} onPress={openShoppingList} accessibilityLabel="Open shopping list">
            <MaterialIcons name="list" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#9C27B0" }]} onPress={clearAll} accessibilityLabel="Clear week plan">
            <MaterialIcons name="delete-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {DAYS.map(day => (
          <View key={day} style={[styles.dayCard, { backgroundColor: surface, borderColor: borderCol }]}>
            <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 8, color: textColor }}>{day}</Text>

            {MEALS.map(meal => {
              const v = plan[day][meal];
              return (
                <TouchableOpacity
                  key={meal}
                  activeOpacity={0.9}
                  onPress={() => openPicker(day, meal)}
                  onLongPress={() => clearSlot(day, meal)}
                  style={[styles.slotCard, { backgroundColor: surface, borderColor: borderCol }]}
                  accessibilityLabel={`Set ${meal} for ${day}`}
                >
                  <View style={styles.slotLeft}>
                    <Text style={[styles.slotMeal, { color: textColor }]}>{meal}</Text>
                    {v ? (
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                        <Image source={v.strMealThumb ? { uri: v.strMealThumb } : HERO} style={styles.smallThumb} />
                        <View style={{ marginLeft: 8, flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontWeight: "700", color: textColor }}>{v.strMeal}</Text>
                          <Text style={{ fontSize: 12, color: dimText }}>
                            {[v.strCategory, v.strArea].filter(Boolean).join(" • ")}
                          </Text>
                          <Text style={[styles.hintText, { color: dimText }]}>Long-press to remove</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={[styles.emptyText, { color: dimText }]}>Tap to choose a recipe</Text>
                    )}
                  </View>

                  <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
                    <View style={[styles.slotAssignBtn, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.slotAssignText}>{v ? "Change" : "Assign"}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "80%", backgroundColor: surface }]}>
            <Text style={[styles.h1, { color: textColor }]}>Pick a recipe</Text>
            <Text style={[styles.p, { color: dimText, marginBottom: 8 }]}>
              {pickTarget.day} • {pickTarget.meal}
            </Text>

            {/* tabs */}
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              {["FAVS","SEARCH"].map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTab(t)}
                  style={[
                    styles.chip,
                    { backgroundColor: surface, borderColor: chipBorder },
                    tab === t && [styles.chipActive, { backgroundColor: theme.dark ? "rgba(233,30,99,0.2)" : "#FFE0ED", borderColor: theme.colors.primary }]
                  ]}
                >
                  <Text style={[styles.chipText, { color: dimText }]}>{t === "FAVS" ? "Favourites" : "Search"}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === "SEARCH" ? (
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder="Search recipes (e.g., curry, pasta)…"
                    placeholderTextColor={theme.dark ? "rgba(255,255,255,0.6)" : "#777"}
                    style={[styles.searchInput, { flex: 1, backgroundColor: surface, borderColor: theme.dark ? "rgba(255,255,255,0.15)" : "#ccc", color: textColor }]}
                    returnKeyType="search"
                    onSubmitEditing={() => runSearch(q)}
                  />
                  <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8, backgroundColor: "#9C27B0" }]} onPress={() => runSearch(q)}>
                    <MaterialIcons name="search" size={20} color="white" />
                  </TouchableOpacity>
                </View>

                {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

                <ScrollView style={{ marginTop: 12 }}>
                  {found.map(item => (
                    <TouchableOpacity
                      key={item.idMeal}
                      style={[styles.pickRow, { backgroundColor: surface, borderColor: borderCol }]}
                      onPress={() => assign(pickTarget.day, pickTarget.meal, item)}
                    >
                      <Image source={item.strMealThumb ? { uri: item.strMealThumb } : HERO} style={styles.pickThumb} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text numberOfLines={1} style={{ fontWeight: "800", color: textColor }}>{item.strMeal}</Text>
                        <Text style={{ fontSize: 12, color: dimText }}>
                          {[item.strCategory, item.strArea].filter(Boolean).join(" • ")}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={theme.dark ? "#bbb" : "#999"} />
                    </TouchableOpacity>
                  ))}
                  {(!loading && found.length === 0 && q.trim().length > 0) && (
                    <Text style={[styles.p, { marginTop: 12, color: dimText }]}>No results.</Text>
                  )}
                </ScrollView>
              </>
            ) : (
              <ScrollView style={{ marginTop: 4 }}>
                {favList.length === 0 && (
                  <Text style={[styles.p, { marginTop: 8, color: dimText }]}>
                    No favourites yet. Save some recipes first.
                  </Text>
                )}
                {favList.map(item => (
                  <TouchableOpacity
                    key={item.idMeal}
                    style={[styles.pickRow, { backgroundColor: surface, borderColor: borderCol }]}
                    onPress={() => assign(pickTarget.day, pickTarget.meal, item)}
                  >
                    <Image source={item.strMealThumb ? { uri: item.strMealThumb } : HERO} style={styles.pickThumb} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text numberOfLines={1} style={{ fontWeight: "800", color: textColor }}>{item.strMeal}</Text>
                      <Text style={{ fontSize: 12, color: dimText }}>
                        {[item.strCategory, item.strArea].filter(Boolean).join(" • ")}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={theme.dark ? "#bbb" : "#999"} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity onPress={() => setPickerOpen(false)} style={{ alignSelf: "center", marginTop: 8 }}>
              <Text style={[styles.linkSmall, { color: "#4452C7" }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Slot chooser (when coming from Details) */}
      <Modal
        visible={slotOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSlotOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "80%", backgroundColor: surface }]}>
            <Text style={[styles.h1, { color: textColor }]}>Choose a slot</Text>
            {!!pendingMeal && (
              <Text style={[styles.p, { color: dimText, marginBottom: 8 }]}>
                {pendingMeal.strMeal}
              </Text>
            )}

            <ScrollView>
              {DAYS.map((day) => (
                <View key={day} style={{ marginBottom: 10 }}>
                  <Text style={{ fontWeight: "800", marginBottom: 6, color: textColor }}>{day}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {MEALS.map((meal) => (
                      <TouchableOpacity
                        key={meal}
                        style={[styles.assignPill, { marginRight: 8, marginBottom: 8, backgroundColor: theme.colors.primary }]}
                        onPress={() => {
                          if (!pendingMeal) return;
                          setPlan((prev) => ({
                            ...prev,
                            [day]: { ...prev[day], [meal]: pendingMeal },
                          }));
                          setSlotOpen(false);
                          setPendingMeal(null);
                        }}
                        accessibilityLabel={`Assign to ${day} ${meal}`}
                      >
                        <Text style={styles.assignPillText}>{meal}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => { setSlotOpen(false); setPendingMeal(null); }}
              style={{ alignSelf: "center", marginTop: 8 }}
            >
              <Text style={[styles.linkSmall, { color: "#4452C7" }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Shopping list modal */}
      <Modal visible={shopOpen} transparent animationType="slide" onRequestClose={() => setShopOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "80%", backgroundColor: surface }]}>
            <Text style={[styles.h1, { color: textColor }]}>Shopping list</Text>
            {shopBusy && <ActivityIndicator style={{ marginTop: 8 }} />}
            {!shopBusy && shopItems.length === 0 && (
              <Text style={[styles.p, { color: dimText, marginTop: 8 }]}>
                No planned meals yet.
              </Text>
            )}
            <ScrollView style={{ marginTop: 8 }}>
              {shopItems.map((it, idx) => (
                <View key={idx} style={[styles.shopRow, { backgroundColor: surface, borderColor: borderCol }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shopName, { color: textColor }]}>{it.name}</Text>
                    <Text style={[styles.p, { color: dimText }]}>{it.amount || "—"}  •  {it.from}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={[styles.formBtn, { flex: 1, backgroundColor: theme.dark ? "rgba(255,255,255,0.1)" : "#ddd" }]} onPress={() => setShopOpen(false)}>
                <Text style={[styles.formBtnText, { color: textColor }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* one-time long-press tip */}
      <Snackbar visible={showTip} onDismiss={() => setShowTip(false)} duration={3500}>
        Tip: long-press any planned meal to remove it.
      </Snackbar>
    </View>
  );
}

const Section = ({ title, children }) => (
  <View style={styles.sectionCard}>
    {!!title && <Text style={styles.sectionHeader}>{title}</Text>}
    {children}
  </View>
);

const SettingRow = ({ label, help, children }) => (
  <View style={styles.settingRow}>
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!help && <Text style={styles.rowHelp}>{help}</Text>}
    </View>
    <View style={{ alignItems: "flex-end" }}>{children}</View>
  </View>
);

const Segmented = ({ options, value, onChange }) => (
  <View style={styles.segmented}>
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.segBtn, active && styles.segBtnActive]}
        >
          <Text style={[styles.segBtnText, active && styles.segBtnTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);


function Settings({ themeMode, setThemeMode }) {
  const { colors, dark } = useTheme();

  // preferences
  const [vegOnly, setVegOnly] = usePersistentState("qb:pref:vegOnly", false);
  const [groupShopping, setGroupShopping] =
    usePersistentState("qb:pref:groupShopping", true);

  // planner defaults
  const [weekStart, setWeekStart] =
    usePersistentState("qb:pref:plannerWeekStart", "Mon");
  const [slotsPref, setSlotsPref] =
    usePersistentState("qb:pref:plannerSlots", ["Breakfast", "Lunch", "Dinner"]);
  const slotMode = slotsPref.length === 4 ? "4" : "3";
  const setSlotMode = (m) =>
    setSlotsPref(
      m === "4"
        ? ["Breakfast", "Lunch", "Snack", "Dinner"]
        : ["Breakfast", "Lunch", "Dinner"]
    );

  // reuseable themed card style
  const cardStyle = [
    styles.settingsCard,
    {
      backgroundColor: colors.surface,
      borderColor: dark ? "rgba(255,255,255,0.14)" : "#eee",
    },
  ];

  return (
    <ScrollView
      style={[styles.settingsScroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.settingsScrollContent}
    >
      <Text style={[styles.h1, { marginBottom: 8, color: colors.onSurface }]}>
        Settings
      </Text>

      {/* Appearance */}
      <View style={cardStyle}>
        <Text style={[styles.settingsSectionTitle, { color: colors.onSurface }]}>
          Appearance
        </Text>

        <View style={[styles.settingRow, styles.settingRowFirst]}>
          <Text style={[styles.rowLabel, { color: colors.onSurface }]}>
            Theme
          </Text>
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.chip, themeMode === "light" && styles.chipActive]}
              onPress={() => setThemeMode("light")}
            >
              <Text style={styles.chipText}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, themeMode === "dark" && styles.chipActive]}
              onPress={() => setThemeMode("dark")}
            >
              <Text style={styles.chipText}>Dark</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Preferences */}
      <View style={cardStyle}>
        <Text style={[styles.settingsSectionTitle, { color: colors.onSurface }]}>
          Preferences
        </Text>

        <View style={[styles.settingRow, styles.settingRowFirst]}>
          <View style={styles.rowLabelWrap}>
            <Text style={[styles.rowLabel, { color: colors.onSurface }]}>
              Vegetarian only
            </Text>
            <Text
              style={[
                styles.rowHelp,
                { color: dark ? "rgba(255,255,255,0.7)" : "#555" },
              ]}
            >
              Show only vegetarian meals in search.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.chip, vegOnly && styles.chipActive]}
            onPress={() => setVegOnly(!vegOnly)}
          >
            <Text style={styles.chipText}>{vegOnly ? "On ✓" : "Off"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.rowLabelWrap}>
            <Text style={[styles.rowLabel, { color: colors.onSurface }]}>
              Group duplicates in shopping list
            </Text>
            <Text
              style={[
                styles.rowHelp,
                { color: dark ? "rgba(255,255,255,0.7)" : "#555" },
              ]}
            >
              Combine the same ingredient across meals.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.chip, groupShopping && styles.chipActive]}
            onPress={() => setGroupShopping(!groupShopping)}
          >
            <Text style={styles.chipText}>
              {groupShopping ? "On ✓" : "Off"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Planner defaults */}
      <View style={cardStyle}>
        <Text style={[styles.settingsSectionTitle, { color: colors.onSurface }]}>
          Planner defaults
        </Text>

        <View style={[styles.settingRow, styles.settingRowFirst]}>
          <Text style={[styles.rowLabel, { color: colors.onSurface }]}>
            Week starts on
          </Text>
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.chip, weekStart === "Mon" && styles.chipActive]}
              onPress={() => setWeekStart("Mon")}
            >
              <Text style={styles.chipText}>Monday</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, weekStart === "Sun" && styles.chipActive]}
              onPress={() => setWeekStart("Sun")}
            >
              <Text style={styles.chipText}>Sunday</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.rowLabel, { color: colors.onSurface }]}>
            Meal slots
          </Text>
          <View style={styles.controlColumn}>
            <TouchableOpacity
              style={[styles.chip, slotMode === "3" && styles.chipActive]}
              onPress={() => setSlotMode("3")}
            >
              <Text style={styles.chipText}>3 meals (B/L/D)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, slotMode === "4" && styles.chipActive]}
              onPress={() => setSlotMode("4")}
            >
              <Text style={styles.chipText}>4 meals (+ Snack)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

/* ---------- app shell ---------- */
export default function App() {
  const [route, navigate, goBack, replace] = useRouter();
  // persist theme across sessions
  const [themeMode, setThemeMode] = usePersistentState("qb:pref:theme", "light");
  const theme = useMemo(() => (themeMode === "dark" ? Dark : Light), [themeMode]);

  // favourites state
  const [favs, setFavs] = usePersistentState("qb:favs", {});
  const isFav = (id) => !!favs[String(id)];
  const toggleFav = (meal) => {
    const id = String(meal.idMeal);
    setFavs((prev) => {
      if (prev[id]) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      const summary = {
        idMeal: id,
        strMeal: meal.strMeal,
        strMealThumb: meal.strMealThumb,
        strCategory: meal.strCategory,
        strArea: meal.strArea,
      };
      return { ...prev, [id]: summary };
    });
  };
  const removeFav = (id) =>
    setFavs((prev) => {
      const copy = { ...prev };
      delete copy[String(id)];
      return copy;
    });

  const favCount = Object.keys(favs).length;
  const showTabs = !["WELCOME", "LOGIN", "SIGNUP"].includes(route.name);

  return (
    <PaperProvider theme={theme}>
      <FavCtx.Provider value={{ favs, isFav, toggleFav, removeFav }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {showTabs && (
            <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
              {route.name === "DETAILS" ? <Appbar.BackAction color="white" onPress={goBack} /> : null}
              <Appbar.Content title="QuickBites" color="white" />
              <IconButton
                icon={(props) => (
                  <MaterialIcons
                    name={themeMode === "dark" ? "light-mode" : "dark-mode"}
                    size={22}
                    color={props.color}
                  />
                )}
                onPress={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}
                accessibilityLabel="Toggle theme"
                iconColor="white"
              />
            </Appbar.Header>
          )}

          {/* routes */}
          {route.name === "WELCOME" && (
            <Welcome
              onContinue={() => navigate("HOME")}
              onLogin={() => navigate("LOGIN")}
              onSignup={() => navigate("SIGNUP")}
            />
          )}

          {route.name === "HOME" && (
            <Home
              onOpen={(id) => navigate("DETAILS", { id })}
              onPlan={(id) => navigate("PLAN", { id })}
            />
          )}

          {route.name === "DETAILS" && (
            <Details
              id={route.params?.id}
              onOpenDetails={(id) => navigate("PLAN", { id })}
            />
          )}

          {route.name === "LOGIN" && (
            <Login onBack={() => goBack()} onSuccess={() => navigate("HOME")} />
          )}

          {route.name === "SIGNUP" && (
            <Signup onBack={() => goBack()} onSuccess={() => navigate("HOME")} />
          )}

          {route.name === "FAVS" && <Favs onOpen={(id) => navigate("DETAILS", { id })} />}

          {route.name === "PLAN" && (
            <Planner
              initialMealId={route.params?.id}
              onOpenDetails={(id) => navigate("DETAILS", { id })}
            />
          )}

          {route.name === "SETTINGS" && (
            <Settings themeMode={themeMode} setThemeMode={setThemeMode} />
          )}

          {/* bottom tabs */}
          {showTabs && (
            <View
              style={[
                styles.tabbar,
                {
                  backgroundColor: theme.colors.surface,
                  borderTopColor: theme.dark ? "rgba(255,255,255,0.15)" : "#ddd",
                },
              ]}
            >
              {TABS.map((t) => {
                const active = route.name === t.key;
                return (
                  <TouchableOpacity key={t.key} style={styles.tab} onPress={() => replace(t.key)}>
                    <View style={styles.tabIconWrap}>
                      <MaterialIcons
                        name={t.icon}
                        size={22}
                        color={active ? theme.colors.primary : (theme.dark ? "#bbb" : "#777")}
                      />
                      {t.key === "FAVS" && favCount > 0 && (
                        <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.badgeText}>{favCount}</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.tabLabel,
                        { color: active ? theme.colors.primary : (theme.dark ? "#bbb" : "#777") },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </SafeAreaView>
      </FavCtx.Provider>
    </PaperProvider>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  h1: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  p: { fontSize: 15, lineHeight: 22 },
  row: { flexDirection: "row", gap: 12, marginTop: 10, flexWrap: "wrap" },

  tabbar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 6 },
  tabLabel: { fontSize: 11, marginTop: 2 },
  tabIconWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -6,
    right: -12,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "white", fontSize: 11, fontWeight: "800" },

  hero: { width: "100%", height: Math.round(H * 0.75) },
  welcomeBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  brand: { fontSize: 36, fontWeight: "800", letterSpacing: 0.5 },
  tagline: { marginTop: 6, fontSize: 14, textAlign: "center" },
  authRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, width: "92%" },
  authBtn: { flex: 1, marginHorizontal: 6, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  authBtnText: { color: "white", fontWeight: "700", fontSize: 16 },
  guestLink: { marginTop: 12, alignSelf: "center" },
  guestText: { fontWeight: "600", textAlign: "center" },

  label: { marginTop: 14, marginBottom: 6, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  eyeBtn: { position: "absolute", right: 12, top: 12, padding: 4 },
  error: { marginTop: 8, fontWeight: "600" },
  formBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  formBtnText: { color: "white", fontWeight: "700", fontSize: 16 },
  linkSmall: { fontWeight: "700" },

  loginScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  /* header card + search */
  headerCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  searchRow: { flexDirection: "row", alignItems: "center" },
  
  toolbarRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  searchBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: "flex-end",
  },
  iconBtn: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },

  /* list cards */
  card: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    marginHorizontal: 16,
  },
  cardThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: "#3a3a3a" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  metaRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  metaChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  metaText: { fontSize: 12, fontWeight: "600", opacity: 0.8 },

  /* grid cards */
  cardGrid: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  cardThumbGrid: { width: "100%", height: 120, borderRadius: 10, marginBottom: 8 },

  /* quick & recent rows */
  sectionTitle: { marginTop: 12, marginBottom: 6, fontWeight: "800", opacity: 0.9 },
  recentHeader: {
    marginTop: 6,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearLink: { fontWeight: "700" },
  sectionDivider: { height: 8, marginVertical: 12 },
  hChipRow: { paddingHorizontal: 4, gap: 8 },
  quickChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  quickChipText: { fontWeight: "700" },

  /* featured */
  featuredCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
  },
  featuredImg: { width: "100%", height: 160 },
  featuredBody: { padding: 12 },
  featuredLabel: { fontSize: 12, fontWeight: "800" },
  featuredTitle: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  featuredMeta: { opacity: 0.7, marginTop: 2 },

  /* modal */
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
  },

  /* details page */
  ingredientRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#E91E63", marginTop: 8, marginRight: 8 },
  ingredientText: { flex: 1, fontSize: 15, lineHeight: 22 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#FFE0ED", color: "#B0004F",
    textAlign: "center", fontWeight: "800", marginRight: 8, marginTop: 2,
  },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22 },

  /* favourite heart */
  heartBtn: {
    position: "absolute",
    right: 6,
    top: 6,
    borderRadius: 999,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  /* shopping list rows */
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  shopCheck: { marginRight: 8 },
  shopName: { fontSize: 16, fontWeight: "700" },

  // small round delete in top-right of each favourite card
  favDeleteBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    borderRadius: 999,
    padding: 6,
    borderWidth: 1,
  },

  gridTitle: {
    marginTop: 6,
    fontWeight: "700",
    fontSize: 14,
  },

  metaChipSm: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignSelf: "flex-start",
    marginTop: 4,
    marginRight: 6,
  },
  metaTextSm: {
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.75,
  },

  // Grid card & image (separate from Home styles to avoid clashes)
  favCardGrid: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
    position: "relative",
  },
  favThumbGrid: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#3a3a3a",
    marginBottom: 6,
  },

  dayCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  slotCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  slotLeft: { flex: 1, paddingRight: 10 },
  slotMeal: { fontWeight: "800", fontSize: 13, opacity: 0.85 },
  slotAssignBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  slotAssignText: { color: "white", fontWeight: "700", fontSize: 12 },
  smallThumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: "#3a3a3a" },
  emptyText: { marginTop: 6, fontSize: 13, opacity: 0.6 },

  // picker rows
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  pickThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#3a3a3a" },

  planBtn: {
    position: "absolute",
    left: 6,
    top: 6,
    borderRadius: 999,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  assignPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  assignPillText: { color: "white", fontWeight: "700", fontSize: 12 },

  hintText: { fontSize: 11, opacity: 0.55, marginTop: 2 },

  /* chips used in settings / tabs / filters */
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "white",
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: "#FFE0ED",
    borderColor: "#E91E63",
  },
  chipText: { fontWeight: "700", color: "#333" },

  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "white",
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: { backgroundColor: "#FFE0ED", borderColor: "#E91E63" },
  filterChipText: { fontWeight: "700", color: "#333" },

    /* settings layout */
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    fontWeight: "800",
    marginBottom: 6,
    fontSize: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  rowLabel: { fontWeight: "700", fontSize: 14 },
  rowHelp: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#f6f6f8",
    borderRadius: 999,
    padding: 2,
  },
  segBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginHorizontal: 2,
  },
  segBtnActive: {
    backgroundColor: "#FFE0ED",
  },
  segBtnText: { fontWeight: "700", fontSize: 12, color: "#333" },
  segBtnTextActive: { color: "#B0004F" },
  resetLinkBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f1b3c9",
    backgroundColor: "#fff5f9",
    marginTop: 6,
  },
  resetLinkText: { color: "#B0004F", fontWeight: "700" },


settingRowFirst: { borderTopWidth: 0 },

settingLabel: {
  fontWeight: "700",
  minWidth: 120,
  marginRight: 12,
  flexShrink: 0,       
},

chipRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 4,
  flexShrink: 1,       
  justifyContent: "flex-end",
},

controlWrapStart: { alignItems: "flex-start" },

controlWrap: {
  flex: 1,
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 12,             
  alignItems: "center",
  marginTop: 2,        
},


settingsScroll: { flex: 1 },
settingsScrollContent: { padding: 16, paddingBottom: 120 },

settingsCard: {
  backgroundColor: "white",
  borderWidth: 1,
  borderColor: "#eee",
  borderRadius: 14,
  padding: 16,
  marginBottom: 12,
},

settingsSectionTitle: {
  fontWeight: "800",
  marginBottom: 12,
  opacity: 0.9,
},

settingRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 12,
  borderTopWidth: 1,
  borderTopColor: "#F1F1F4",
  gap: 12,
},

settingRowFirst: { borderTopWidth: 0, paddingTop: 4 },

rowLabelWrap: { flex: 1, paddingRight: 10 },
rowLabel: { fontWeight: "700" },
rowHelp: { fontSize: 12, opacity: 0.6, marginTop: 2 },

controlRow: { flexDirection: "row", gap: 8 },
controlColumn: { flexDirection: "column", gap: 10, alignItems: "flex-start" },

});
