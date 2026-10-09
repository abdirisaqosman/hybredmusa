import { useState } from "react";
import { toast } from "sonner";
import type { Food, Meal } from "@hybredmusa/shared";
import {
  useAddFoodLog,
  useBarcodeLookup,
  useCreateCustomFood,
  useFoodSearch,
} from "@/api/nutrition";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScanner } from "./BarcodeScanner";

interface Props {
  clientId: string;
  date: string;
  meal: Meal;
}

export function AddFoodDialog({ clientId, date, meal }: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);

  const close = () => {
    setOpen(false);
    setPicked(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPicked(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Add food
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to {meal}</DialogTitle>
          <DialogDescription>Search, scan a barcode, or enter the numbers.</DialogDescription>
        </DialogHeader>

        {picked ? (
          <PortionForm
            clientId={clientId}
            date={date}
            meal={meal}
            food={picked}
            onBack={() => setPicked(null)}
            onDone={close}
          />
        ) : (
          <Tabs defaultValue="search">
            <TabsList className="w-full">
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="scan">Scan</TabsTrigger>
              <TabsTrigger value="quick">Quick add</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="search">
              <SearchTab onPick={setPicked} />
            </TabsContent>
            <TabsContent value="scan">
              <ScanTab onPick={setPicked} />
            </TabsContent>
            <TabsContent value="quick">
              <QuickAddTab clientId={clientId} date={date} meal={meal} onDone={close} />
            </TabsContent>
            <TabsContent value="custom">
              <CustomFoodTab onPick={setPicked} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FoodRow({ food, onPick }: { food: Food; onPick: (food: Food) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(food)}
      className="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-accent"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{food.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {food.brand ? `${food.brand} - ` : ""}
          {food.caloriesPer100g} kcal / 100 g
        </span>
      </span>
      <span className="text-xs uppercase text-muted-foreground">{food.source}</span>
    </button>
  );
}

function SearchTab({ onPick }: { onPick: (food: Food) => void }) {
  const [query, setQuery] = useState("");
  const search = useFoodSearch(query);

  return (
    <div className="space-y-3 pt-2">
      <Input
        placeholder="Chicken breast, oats, yoghurt..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {search.isFetching && <Skeleton className="h-24 w-full" />}
      {search.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing found. Try a custom food.</p>
      )}
      <div className="space-y-2">
        {search.data?.items.map((food) => (
          <FoodRow key={food.ref} food={food} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function ScanTab({ onPick }: { onPick: (food: Food) => void }) {
  const [barcode, setBarcode] = useState("");
  const lookup = useBarcodeLookup();

  const find = (code: string) =>
    lookup.mutate(code, {
      onSuccess: onPick,
      onError: (error) => toast.error(error.message),
    });

  return (
    <div className="space-y-3 pt-2">
      <BarcodeScanner onDetected={find} />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (barcode.trim()) find(barcode.trim());
        }}
      >
        <Input
          inputMode="numeric"
          placeholder="Or type the barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <Button type="submit" disabled={lookup.isPending}>
          Find
        </Button>
      </form>
    </div>
  );
}

function PortionForm({
  clientId,
  date,
  meal,
  food,
  onBack,
  onDone,
}: Props & { food: Food; onBack: () => void; onDone: () => void }) {
  const [grams, setGrams] = useState("100");
  const addLog = useAddFoodLog(clientId, date);
  const amount = Number(grams) || 0;
  const scale = amount / 100;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        addLog.mutate(
          { kind: "food", date, meal, foodRef: food.ref, grams: amount },
          {
            onSuccess: () => {
              toast.success(`${food.name} added`);
              onDone();
            },
            onError: (error) => toast.error(error.message),
          },
        );
      }}
    >
      <div>
        <p className="text-sm font-medium">{food.name}</p>
        {food.brand && <p className="text-xs text-muted-foreground">{food.brand}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="grams">Grams</Label>
        <Input
          id="grams"
          inputMode="decimal"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          required
        />
      </div>

      <dl className="grid grid-cols-4 gap-2 text-sm">
        {[
          ["kcal", food.caloriesPer100g],
          ["P", food.proteinPer100g],
          ["C", food.carbsPer100g],
          ["F", food.fatPer100g],
        ].map(([label, per100]) => (
          <div key={label as string}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{Math.round((per100 as number) * scale * 10) / 10}</dd>
          </div>
        ))}
      </dl>

      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={addLog.isPending || amount <= 0}>
          {addLog.isPending ? "Adding..." : "Add"}
        </Button>
      </div>
    </form>
  );
}

function QuickAddTab({
  clientId,
  date,
  meal,
  onDone,
}: Props & { onDone: () => void }) {
  const addLog = useAddFoodLog(clientId, date);
  const [values, setValues] = useState({
    name: "",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
  });

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <form
      className="space-y-3 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        addLog.mutate(
          {
            kind: "quick",
            date,
            meal,
            name: values.name,
            calories: Number(values.calories) || 0,
            proteinG: Number(values.proteinG) || 0,
            carbsG: Number(values.carbsG) || 0,
            fatG: Number(values.fatG) || 0,
          },
          {
            onSuccess: () => {
              toast.success("Added");
              onDone();
            },
            onError: (error) => toast.error(error.message),
          },
        );
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="quick-name">What was it</Label>
        <Input id="quick-name" required value={values.name} onChange={set("name")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["calories", "Calories"],
            ["proteinG", "Protein g"],
            ["carbsG", "Carbs g"],
            ["fatG", "Fat g"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`quick-${key}`}>{label}</Label>
            <Input
              id={`quick-${key}`}
              inputMode="decimal"
              value={values[key]}
              onChange={set(key)}
            />
          </div>
        ))}
      </div>
      <Button type="submit" className="w-full" disabled={addLog.isPending}>
        {addLog.isPending ? "Adding..." : "Add"}
      </Button>
    </form>
  );
}

function CustomFoodTab({ onPick }: { onPick: (food: Food) => void }) {
  const createFood = useCreateCustomFood();
  const [values, setValues] = useState({
    name: "",
    brand: "",
    caloriesPer100g: "",
    proteinPer100g: "",
    carbsPer100g: "",
    fatPer100g: "",
  });

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <form
      className="space-y-3 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        createFood.mutate(
          {
            name: values.name,
            brand: values.brand || undefined,
            caloriesPer100g: Number(values.caloriesPer100g) || 0,
            proteinPer100g: Number(values.proteinPer100g) || 0,
            carbsPer100g: Number(values.carbsPer100g) || 0,
            fatPer100g: Number(values.fatPer100g) || 0,
          },
          { onSuccess: onPick, onError: (error) => toast.error(error.message) },
        );
      }}
    >
      <p className="text-xs text-muted-foreground">All values are per 100 g.</p>
      <div className="space-y-2">
        <Label htmlFor="custom-name">Name</Label>
        <Input id="custom-name" required value={values.name} onChange={set("name")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="custom-brand">Brand (optional)</Label>
        <Input id="custom-brand" value={values.brand} onChange={set("brand")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["caloriesPer100g", "Calories"],
            ["proteinPer100g", "Protein g"],
            ["carbsPer100g", "Carbs g"],
            ["fatPer100g", "Fat g"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`custom-${key}`}>{label}</Label>
            <Input
              id={`custom-${key}`}
              inputMode="decimal"
              required
              value={values[key]}
              onChange={set(key)}
            />
          </div>
        ))}
      </div>
      <Button type="submit" className="w-full" disabled={createFood.isPending}>
        {createFood.isPending ? "Saving..." : "Save and use"}
      </Button>
    </form>
  );
}
