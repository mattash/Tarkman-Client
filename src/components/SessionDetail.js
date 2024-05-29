// src/components/SessionDetail.js
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import PartsList from './PartsList';
import Explanations from './Explanations';
import { Drawer } from 'vaul';
import { PusherProvider } from '../context/PusherContext';

const SessionDetail = () => {
  const { id } = useParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <PusherProvider sessionId={id}>
      <div>
        <PartsList sessionId={id} isDrawerOpen={isDrawerOpen} />
        <Drawer.Root shouldScaleBackground onClose={() => setIsDrawerOpen(false)}>
          <Drawer.Trigger asChild>
            <button className="fixed bottom-2 right-2 rounded-full p-2 shadow-md">Learn More&hellip;</button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40" />
            <Drawer.Content className="bg-zinc-100 flex flex-col rounded-t-[10px] h-[76%] mt-24 fixed bottom-0 left-0 right-0 z-10">
              <div className="p-4 bg-white rounded-t-[10px] flex-1 overflow-y-auto overflow-scrolling-touch">
                <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300 mb-8" />
                <div className="mx-auto">
                  <Drawer.Title className="font-medium mb-4 text-gray-600">
                    Current Explanations
                  </Drawer.Title>
                  <Explanations sessionId={id} />
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </PusherProvider>
  );
};

export default SessionDetail;
