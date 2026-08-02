/**
 * Gimmick · Obsidian — Visore spark a schermo intero.
 *
 * Si apre toccando uno spark nel dettaglio tile. Tratta tre casi distinti:
 *
 *  - immagine → si disegna qui dentro, su fondo nero, tocco per chiudere;
 *  - video    → lettore in-app con i comandi nativi;
 *  - il resto → si consegna all'app di sistema (PDF, documenti, audio).
 *
 * L'ultimo caso non è una resa: un PDF nel telefono lo apre un lettore vero, con
 * ricerca, zoom e pagine, mentre qui dentro potremmo al massimo mostrarne
 * un'immagine. Senza `react-native-webview` non esiste nemmeno quella via.
 *
 * L'URL è firmato AL MOMENTO DEL TOCCO, non insieme alla lista: il visore vuole
 * l'ORIGINALE (`storage_path`), mentre le schede si accontentano della
 * miniatura, che a schermo pieno risulterebbe sgranata. Firmare tutti gli
 * originali in anticipo sarebbe lavoro sprecato per file che quasi sempre non
 * vengono aperti.
 */
import React from 'react';
import { Modal, View, Text, Pressable, Image, ActivityIndicator, Linking, StatusBar } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { IconX } from '@tabler/icons-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uploadApi } from '@/lib/api';
import type { Spark } from '@/types';

/** Vero per gli spark che il visore sa disegnare da sé. */
function isImageSpark(s: Spark): boolean {
  return s.type === 'photo' || s.type === 'image' || !!s.mime_type?.startsWith('image/');
}

export interface SparkViewerProps {
  /** Spark da mostrare; `null` tiene il visore chiuso. */
  spark: Spark | null;
  onClose: () => void;
}

export function SparkViewer({ spark, onClose }: SparkViewerProps) {
  const insets = useSafeAreaInsets();
  const path = spark?.storage_path ?? null;

  const urlQuery = useQuery({
    queryKey: ['spark-full-url', path],
    queryFn: () => uploadApi.getSignedUrl(path!),
    enabled: !!path,
    // Sotto l'ora di validità della firma: oltre si mostrerebbe un URL scaduto.
    staleTime: 50 * 60 * 1000,
  });
  const url = urlQuery.data?.data?.url ?? null;

  const isImage = !!spark && isImageSpark(spark);
  const isVideo = spark?.type === 'video';
  const handOff = !!spark && !isImage && !isVideo;

  // Consegna all'app di sistema. Il ref evita che l'effetto la richiami a ogni
  // ridisegno: l'app esterna torna a fuoco e ripartirebbe in cerchio.
  const handedOff = React.useRef<string | null>(null);
  const [handOffFailed, setHandOffFailed] = React.useState(false);
  React.useEffect(() => {
    if (!handOff || !url || handedOff.current === url) return;
    handedOff.current = url;
    Linking.openURL(url).then(
      () => onClose(),
      () => setHandOffFailed(true),
    );
  }, [handOff, url, onClose]);

  // Alla chiusura si riparte puliti, altrimenti riaprendo lo stesso file il ref
  // lo considererebbe già consegnato e non succederebbe nulla.
  React.useEffect(() => {
    if (!spark) { handedOff.current = null; setHandOffFailed(false); }
  }, [spark]);

  return (
    <Modal visible={!!spark} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Il tocco chiude solo per le immagini: sul video prenderebbe i comandi
            del lettore, e nella consegna non c'è nulla da toccare. */}
        <Pressable
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          onPress={isImage ? onClose : undefined}
          disabled={!isImage}
        >
          {urlQuery.isLoading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : !url ? (
            <Text style={{ color: '#fff', fontSize: 15, paddingHorizontal: 32, textAlign: 'center' }}>
              Non riesco ad aprire questo file.
            </Text>
          ) : isImage ? (
            // `contain`: a schermo pieno si guarda l'immagine intera, non un suo
            // ritaglio — al contrario della scheda, dove il taglio tiene la riga
            // regolare.
            <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          ) : isVideo ? (
            <Video
              source={{ uri: url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
            />
          ) : handOffFailed ? (
            <Text style={{ color: '#fff', fontSize: 15, paddingHorizontal: 32, textAlign: 'center' }}>
              Nessuna app installata sa aprire {spark?.file_name || 'questo file'}.
            </Text>
          ) : (
            <ActivityIndicator size="large" color="#fff" />
          )}
        </Pressable>

        {/* La X resta sempre: sul video il tocco è del lettore, e senza questa
            si uscirebbe solo col tasto Indietro. */}
        <Pressable
          onPress={onClose}
          accessibilityLabel="Chiudi"
          hitSlop={12}
          style={{
            position: 'absolute', top: insets.top + 10, right: 14,
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconX size={22} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>
    </Modal>
  );
}
