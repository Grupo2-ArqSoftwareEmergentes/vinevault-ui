import { Observable } from 'rxjs';
import { WineCellarId } from '../model/valueobjects/wine-cellar-id.value-object';

export type WineCellar = Readonly<{
  id: WineCellarId;
  spaceId: { value: string };
  name: string;
  description: string | null;
  temperatureMin: number;
  temperatureMax: number;
  humidityMin: number;
  humidityMax: number;
  deviceId: { value: string } | null;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export abstract class WineCellarQueryService {
  abstract getWineCellarsBySpace(spaceId: string): Observable<readonly WineCellar[]>;
}
